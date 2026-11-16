import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { artifacts, prepared, save, waitUntil } from '../helpers.mjs';
import { DockerBackend } from '../../dist/docker.js';
import { BASE_IMAGE } from '../../dist/policy.js';
import { ProjectRunner } from '../../dist/project.js';
import { Store } from '../../dist/store.js';

const CHECK=`import {readFileSync,writeFileSync} from 'node:fs';
import {connect} from 'node:net';
import {networkInterfaces} from 'node:os';
const result={uid:process.getuid(),cwd:process.cwd(),source:readFileSync('check.mjs','utf8').length>0,interfaces:Object.keys(networkInterfaces())};
// UID 1000 has write permission on each path, so only the read-only mount can refuse the write.
for(const [key,path] of [['work','/work/writable.txt'],['root','/home/node/x'],['tmp','/tmp/x']]){try{writeFileSync(path,'1');result[key]='written';}catch(error){result[key]=error.code;}}
result.egress=await new Promise(resolve=>{const socket=connect({host:'1.1.1.1',port:53,timeout:1000});socket.once('connect',()=>{socket.destroy();resolve('connected');});socket.once('error',error=>resolve(error.code));socket.once('timeout',()=>{socket.destroy();resolve('timeout');});});
console.log(JSON.stringify(result));
process.exit(7);
`;
async function session(label, files, options, argv) {
  const {dir,config}=await prepared(label);
  const app=join(artifacts,`${label}-app`);mkdirSync(app,{mode:0o755});
  for(const [name,content] of Object.entries(files)) {writeFileSync(join(app,name),content);chmodSync(join(app,name),0o666);}
  const expiry=new Date(Date.now()+600000).toISOString();
  const approved=JSON.parse(execFileSync(process.execPath,['dist/host.js','approve-project',dir,'report-1','tests-1',app,BASE_IMAGE,expiry,...options,'--',...argv],{encoding:'utf8'}));
  const store=new Store(dir),backend=new DockerBackend(config,dir),runner=await ProjectRunner.open(store,config,backend);
  const created=runner.create(store.read(approved.capabilityFile));
  const leftovers=()=>backend.command(['container','ls','-a','--filter',`label=io.podori.project=${config.owner}`,'--format','{{.ID}}']);
  return {runner,leftovers,credentials:{projectId:created.projectId,accessToken:created.accessToken}};
}
const finished=(runner,credentials)=>waitUntil(()=>{const run=runner.status(credentials).runs.at(-1);return run.state==='running'?null:run;},60000);

test('P10: a real project command runs non-root over a read-only mount without network and is removed', async () => {
  const {runner,leftovers,credentials}=await session('project',{'check.mjs':CHECK,'writable.txt':'0'},['--memory-mib=128','--cpus=0.5','--timeout=30'],['/usr/local/bin/node','check.mjs']);
  try {
    runner.run(credentials);
    const run=await finished(runner,credentials);save('project-run',run);
    assert.deepEqual([run.state,run.exitCode,run.oomKilled],['exited',7,false]);
    const observed=JSON.parse(run.outputTail);
    assert.deepEqual({uid:observed.uid,cwd:observed.cwd,source:observed.source,work:observed.work,root:observed.root,tmp:observed.tmp,interfaces:observed.interfaces},{uid:1000,cwd:'/work',source:true,work:'EROFS',root:'EROFS',tmp:'written',interfaces:['lo']});
    assert.notEqual(observed.egress,'connected');
    assert.deepEqual(run.controls.mounts.filter(mount=>mount.type==='bind'),[{type:'bind',destination:'/work',rw:false}]);
    assert.equal(await leftovers(),'');
  } finally {await runner.close();}
});

test('P11: a real project command that exceeds its time limit is killed and removed', async () => {
  const {runner,leftovers,credentials}=await session('project-timeout',{'wait.mjs':'setInterval(()=>{},1000);\n'},['--memory-mib=128','--cpus=0.5','--timeout=3'],['/usr/local/bin/node','wait.mjs']);
  try {
    runner.run(credentials);
    const run=await finished(runner,credentials);save('project-timeout-run',run);
    assert.deepEqual([run.state,run.reason],['timed_out','run-timeout']);
    assert.equal(await leftovers(),'');
  } finally {await runner.close();}
});
