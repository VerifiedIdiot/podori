import { randomBytes, randomUUID } from 'node:crypto';
import { Approval, BUDGET, Config, ImageId, PROJECT, ProjectApproval, ProjectBudget, ProjectDir, Reference, Runtime, Scenario, digest } from './policy.js';
import { Store } from './store.js';
import { DockerBackend, prepare } from './docker.js';
import { projectDirValid, projectTreeValid } from './project.js';
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
  } else if(command==='approve-project' && args.includes('--') && args.indexOf('--')>=5) {
    // approve-project <state> <reportId> <itemId> <projectDir> <image> <expiresAt> [--memory-mib=N --cpus=N --timeout=N --pids=N --tmp-mib=N] -- <argv...>
    const store=new Store(root), config=Config.parse(store.read('policy.json'));
    if(store.names('project-grant-').length>=PROJECT.sessions)throw new Error('approval-limit');
    const split=args.indexOf('--'), [reportId,itemId,projectDir,imageRef,expiresAt,...options]=args.slice(0,split), argv=args.slice(split+1);
    Reference.parse(reportId);Reference.parse(itemId);
    const dir=ProjectDir.parse(projectDir);projectDirValid(dir,config,store.root);projectTreeValid(dir);
    if(!/^[A-Za-z0-9][A-Za-z0-9_.\/:@-]{0,255}$/.test(imageRef ?? ''))throw new Error('invalid-image-reference');
    const expiry=Date.parse(expiresAt!);
    if(!Number.isFinite(expiry) || expiry<=Date.now() || expiry>Date.now()+86400000)throw new Error('invalid-approval-expiry');
    const limits:Record<string,number>={memory:1073741824,cpu:2,runSeconds:600,pids:256,tmpfs:268435456};
    for(const option of options) {
      const match=/^--(memory-mib|cpus|timeout|pids|tmp-mib)=(\d+(?:\.\d+)?)$/.exec(option);
      if(!match)throw new Error('invalid-host-command');
      const value=Number(match[2]);
      if(match[1]==='memory-mib')limits.memory=value*1048576;
      else if(match[1]==='cpus')limits.cpu=value;
      else if(match[1]==='timeout')limits.runSeconds=value;
      else if(match[1]==='pids')limits.pids=value;
      else limits.tmpfs=value*1048576;
    }
    const budget=ProjectBudget.parse(limits);
    const image=JSON.parse(await new DockerBackend(config,root).command(['image','inspect',imageRef!]))[0];
    const imageId=ImageId.parse(image?.Id);
    if(image.Os!=='linux' || `linux/${image.Architecture}`!==config.platform)throw new Error('image-not-verified');
    const id=randomUUID(), token=randomBytes(32).toString('hex');
    const grant=ProjectApproval.parse({version:2,runtime:config.runtime,runtimeConfigHash:config.runtimeConfigHash,platform:config.platform,id,reportId,itemId,target:'project',projectDir:dir,imageId,argv,budget,expiresAt,claimHash:digest(token)});
    store.write(`project-grant-${id}.json`,grant);
    const capabilityFile=`project-capability-${id}.json`;
    store.write(capabilityFile,{approvalId:id,claimToken:token});
    process.stdout.write(JSON.stringify({approvalId:id,capabilityFile,projectDir:dir,imageId,argv,budget})+'\n');
  } else throw new Error('invalid-host-command');
}
void main().catch(error=>{process.stderr.write(safeError(error)+'\n');process.exitCode=1;});
