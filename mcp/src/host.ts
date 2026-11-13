import { randomBytes, randomUUID } from 'node:crypto';
import { Approval, BUDGET, Config, Reference, Runtime, Scenario, digest } from './policy.js';
import { Store } from './store.js';
import { prepare } from './docker.js';
import { safeError } from './controller.js';

async function main():Promise<void> {
  const [command,root,...args]=process.argv.slice(2);
  if(!root)throw new Error('state-directory-required');
  if(command==='prepare' && (args.length===1 || (args.length===2 && /^--runtime=(runc|runsc|kata)$/.test(args[1]!)))) {
    const runtime=Runtime.parse(args[1]?.slice('--runtime='.length) ?? 'runc');
    new Store(root,true);
    if(new Store(root).names('policy').length>0)throw new Error('already-prepared');
    const config=await prepare(root,args[0]!,runtime);
    process.stdout.write(JSON.stringify({prepared:true,runtime:config.runtime,runtimeConfigHash:config.runtimeConfigHash,platform:config.platform,imageId:config.imageId,fixtureRevision:config.fixtureRevision})+'\n');
  } else if(command==='approve' && args.length===4) {
    const store=new Store(root), config=Config.parse(store.read('policy.json'));
    if(store.names('grant-').length>=BUDGET.records)throw new Error('approval-limit');
    const [reportId,itemId,scenario,expiresAt]=args;
    Reference.parse(reportId);Reference.parse(itemId);Scenario.parse(scenario);
    const expiry=Date.parse(expiresAt!);
    if(!Number.isFinite(expiry) || expiry<=Date.now() || expiry>Date.now()+86400000)throw new Error('invalid-approval-expiry');
    const id=randomUUID(), token=randomBytes(32).toString('hex');
    const grant=Approval.parse({version:2,runtime:config.runtime,runtimeConfigHash:config.runtimeConfigHash,platform:config.platform,id,reportId,itemId,target:'synthetic-http-v1',scenario,fixtureRevision:config.fixtureRevision,imageId:config.imageId,budget:BUDGET,expiresAt,claimHash:digest(token)});
    store.write(`grant-${id}.json`,grant);
    const capabilityFile=`capability-${id}.json`;
    store.write(capabilityFile,{approvalId:id,claimToken:token});
    process.stdout.write(JSON.stringify({approvalId:id,capabilityFile})+'\n');
  } else throw new Error('invalid-host-command');
}
void main().catch(error=>{process.stderr.write(safeError(error)+'\n');process.exitCode=1;});
