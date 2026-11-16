import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, renameSync, symlinkSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { Controller } from '../dist/controller.js';
import { DockerBackend, outputDigest } from '../dist/docker.js';
import { Store } from '../dist/store.js';
import { PROJECT, ProjectApproval, ProjectBudget, ProjectDir, digest } from '../dist/policy.js';
import { ProjectRunner, enforceProjectContainer, projectDirValid } from '../dist/project.js';
import { configuration, host, socketFixture } from './runtime-helpers.mjs';

const IMAGE=`sha256:${'b'.repeat(64)}`;
const BUDGET={cpu:0.5,memory:134217728,pids:64,tmpfs:8388608,runSeconds:5};
function inspection(config,grant,runId) {
  return {Name:`/podori-project-${config.owner}-${runId}`,Image:grant.imageId,
    Config:{User:'1000:1000',WorkingDir:'/work',Labels:{'io.podori.project':config.owner,'io.podori.run':runId},Entrypoint:[grant.argv[0]],Cmd:grant.argv.slice(1)},
    HostConfig:{Runtime:config.runtime,NetworkMode:'none',ReadonlyRootfs:true,Privileged:false,CapDrop:['ALL'],CapAdd:null,SecurityOpt:['no-new-privileges'],Memory:grant.budget.memory,MemorySwap:grant.budget.memory,NanoCpus:grant.budget.cpu*1e9,PidsLimit:grant.budget.pids,Tmpfs:{'/tmp':`rw,nosuid,nodev,size=${grant.budget.tmpfs},mode=1777`},Binds:null,RestartPolicy:{Name:'no'},PortBindings:{},LogConfig:{Type:'none'}},
    Mounts:[{Type:'bind',Source:grant.projectDir,Destination:'/work',RW:false}],State:{Running:false,ExitCode:0,OOMKilled:false,Status:'created'}};
}
async function setup(t) {
  const {root,endpoint}=await socketFixture(t),config=configuration({endpoint}),store=new Store(root);
  store.write('policy.json',config);
  const projectDir=join(root,'app');mkdirSync(projectDir);
  class RecordedDocker extends DockerBackend {
    current=null;calls=[];tamper=x=>x;exitCode=0;output={bytes:3,hash:'c'.repeat(64),tail:'ok\n',truncated:false,timedOut:false};hold=false;started=true;
    async command(args) {
      this.calls.push(args);
      if(args[0]==='info')return JSON.stringify(host());
      if(args[0]==='image')return JSON.stringify([{Id:IMAGE,Os:'linux',Architecture:'arm64'}]);
      if(args[1]==='ls')return this.current?'cid':'';
      if(args[1]==='rm') {this.current=null;return '';}
      if(args[1]==='create') {
        const runId=args[args.indexOf('--name')+1].slice(`podori-project-${config.owner}-`.length);
        this.current=inspection(config,this.grant,runId);return 'cid';
      }
      if(args[1]==='inspect')return JSON.stringify([this.tamper(structuredClone(this.current))]);
      throw new Error('unexpected-command');
    }
    async stream(_args,_limit,signal) {
      if(this.hold)await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));
      if(this.started){this.current.State.ExitCode=this.exitCode;this.current.State.Status='exited';}
      return {...this.output,exitCode:this.started?this.exitCode:1};
    }
  }
  const backend=new RecordedDocker(config,root),runner=await ProjectRunner.open(store,config,backend);
  t.after(()=>runner.close());
  function claim(patch={}) {
    const id=randomUUID(),token='d'.repeat(64);
    const grant=ProjectApproval.parse({version:2,runtime:config.runtime,runtimeConfigHash:config.runtimeConfigHash,platform:config.platform,id,reportId:'report-1',itemId:'tests-1',target:'project',projectDir,imageId:IMAGE,argv:['/bin/sh','-c','npm test'],budget:BUDGET,expiresAt:new Date(Date.now()+60_000).toISOString(),claimHash:digest(token),...patch});
    store.write(`project-grant-${id}.json`,grant);backend.grant=grant;
    return {grant,input:{approvalId:id,claimToken:token}};
  }
  return {root,config,store,backend,runner,claim,projectDir};
}
const access=value=>({projectId:value.projectId,accessToken:value.accessToken});
async function settled(runner,credentials) {
  for(let i=0;i<200;i++) {const run=runner.status(credentials).runs.at(-1);if(run.state!=='running')return run;await new Promise(resolve=>setTimeout(resolve,5));}
  throw new Error('project-run-timeout');
}

test('P01: a project run uses only the approved command, image and read-only mount, then removes the container', async t => {
  const {runner,backend,claim,projectDir}=await setup(t);
  const {grant,input}=claim();backend.exitCode=3;
  const session=runner.create(input),credentials=access(session);
  assert.deepEqual(session.argv,grant.argv);
  runner.run(credentials);
  const run=await settled(runner,credentials);
  assert.deepEqual([run.state,run.exitCode,run.outputTail,run.oomKilled],['exited',3,'ok\n',false]);
  const create=backend.calls.find(args=>args[1]==='create');
  for(const pair of [['--network','none'],['--user','1000:1000'],['--cap-drop','ALL'],['--mount',`type=bind,src=${projectDir},dst=/work,readonly`],['--entrypoint','/bin/sh'],['--pull=never','--runtime']])assert.equal(create[create.indexOf(pair[0])+1],pair[1]);
  assert.ok(create.includes('--read-only') && create.includes('--no-healthcheck'));
  assert.ok(backend.calls.filter(args=>args[1]==='rm').every(args=>args.includes('--volumes')),'Removal must include anonymous volumes');
  assert.deepEqual(create.slice(create.indexOf(IMAGE)),[IMAGE,'-c','npm test']);
  assert.equal(backend.current,null,'The container must be removed after the run');
  assert.equal(backend.calls.some(args=>args[1]==='exec'),false);
});

test('P02: changed container controls stop a project run before start', async t => {
  const {config,claim}=await setup(t);
  const {grant}=claim(),runId=randomUUID(),name=`podori-project-${config.owner}-${runId}`;
  enforceProjectContainer(inspection(config,grant,runId),grant,config,name,runId);
  const cases={
    'container-runtime-mismatch':c=>{c.HostConfig.Runtime='other';},
    'container-identity-mismatch':c=>{c.Config.Cmd=['-c','curl attacker'];},
    'container-controls-mismatch':c=>{c.HostConfig.NetworkMode='bridge';},
    'container-storage-mismatch':c=>{c.Mounts[0].RW=true;},
  };
  for(const [expected,change] of Object.entries(cases)) {
    const changed=inspection(config,grant,runId);change(changed);
    assert.throws(()=>enforceProjectContainer(changed,grant,config,name,runId),{message:expected});
  }
  for(const change of [c=>{c.Mounts.push({Type:'bind',Source:'/etc',Destination:'/host',RW:false});},c=>{c.Mounts.push({Type:'volume',Destination:'/data',RW:true});},c=>{c.Mounts[0].Source='/etc';},c=>{c.HostConfig.Privileged=true;},c=>{c.Image=`sha256:${'e'.repeat(64)}`;}]) {
    const changed=inspection(config,grant,runId);change(changed);
    assert.throws(()=>enforceProjectContainer(changed,grant,config,name,runId));
  }
});

test('P03: a tampered container is never started and is removed', async t => {
  const {runner,backend,claim}=await setup(t);
  const credentials=access(runner.create(claim().input));
  backend.tamper=c=>{c.HostConfig.NetworkMode='bridge';return c;};
  let started=false;backend.stream=async()=>{started=true;return {...backend.output,exitCode:0};};
  runner.run(credentials);
  const run=await settled(runner,credentials);
  assert.deepEqual([run.state,run.reason,started,backend.current],['error','container-controls-mismatch',false,null]);
});

test('P04: project approvals are single-use, token-bound, expiring, and separate from fixture approvals', async t => {
  const {root,runner,store,claim}=await setup(t);
  const {grant,input}=claim();
  assert.throws(()=>runner.create({...input,claimToken:'e'.repeat(64)}),{message:'access-denied'});
  const session=runner.create(input),credentials=access(session);
  assert.throws(()=>runner.create(input),{message:'approval-already-used'});
  assert.throws(()=>runner.status({...credentials,accessToken:'e'.repeat(64)}),{message:'access-denied'});
  assert.throws(()=>runner.create(claim({expiresAt:new Date(Date.now()-1).toISOString()}).input),{message:'access-denied'});
  for(let i=1;i<PROJECT.sessions;i++)runner.create(claim().input);
  assert.throws(()=>runner.create(claim().input),{message:'record-limit'});
  store.write(`project-grant-${grant.id}.json`,{...grant,argv:['/bin/sh','-c','other']});
  assert.throws(()=>runner.run(credentials),{message:'approval-changed'});
  await runner.close();
  const controller=await Controller.open(root,runner.backend);
  t.after(()=>controller.close());
  assert.throws(()=>controller.create(input),{message:'access-denied'});
});

test('P05: a project run stops on timeout or cancellation and allows one run at a time', async t => {
  const {runner,backend,claim}=await setup(t);
  const credentials=access(runner.create(claim().input));
  backend.output={...backend.output,timedOut:true};
  runner.run(credentials);
  assert.deepEqual((await settled(runner,credentials)).state,'timed_out');
  backend.output={...backend.output,timedOut:false};backend.hold=true;
  runner.run(credentials);
  assert.throws(()=>runner.run(credentials),{message:'concurrency-limit'});
  const cancelled=await runner.cancel(credentials);
  assert.deepEqual([cancelled.runs.at(-1).state,cancelled.runs.at(-1).reason,backend.current],['cancelled','owner-cancellation',null]);
});

test('P06: the project directory, command and budget stay inside fixed bounds', async t => {
  const {root,config,runner,claim,projectDir}=await setup(t);
  assert.throws(()=>projectDirValid(root,config,root),{message:'project-directory-contains-state'});
  assert.throws(()=>projectDirValid(join(root,'missing'),config,root),{message:'project-directory-unavailable'});
  for(const path of ['relative','/','/a,b','/a/../b','/a/','/a"b','/a\\b'])assert.equal(ProjectDir.safeParse(path).success,false,path);
  assert.equal(ProjectDir.safeParse('/Users/me/my app').success,true);
  for(const patch of [{memory:8589934592},{cpu:16},{cpu:1.333},{runSeconds:86400},{pids:1},{tmpfs:1}])assert.equal(ProjectBudget.safeParse({...BUDGET,...patch}).success,false);
  const credentials=access(runner.create(claim().input));
  renameSync(projectDir,projectDir+'-real');symlinkSync('/etc',projectDir);
  assert.throws(()=>runner.run(credentials),{message:'project-directory-changed'});
});

test('P07: a restart marks interrupted runs unverified and removes leftover project containers', async t => {
  const {store,config,runner,backend,claim}=await setup(t);
  const credentials=access(runner.create(claim().input));
  backend.hold=true;runner.run(credentials);
  const file=`project-session-${credentials.projectId}.json`,saved=store.read(file);
  assert.equal(saved.runs[0].state,'running');
  await runner.close();
  store.write(file,saved);backend.current={leftover:true};
  const reopened=await ProjectRunner.open(store,config,backend);
  const run=reopened.status(credentials).runs[0];
  assert.deepEqual([run.state,run.reason,backend.current],['error','server-restart',null]);
});

test('P08: stored output stays bounded across the run limit and control bytes cannot crash the server', async t => {
  const {runner,backend,store,claim}=await setup(t);
  const credentials=access(runner.create(claim().input));
  const output=outputDigest();output.update(Buffer.alloc(PROJECT.tailBytes*3,1));
  const digested=output.result(false,0);
  assert.equal(digested.tail,'?'.repeat(PROJECT.tailBytes));
  assert.equal(digested.bytes,PROJECT.tailBytes*3);
  backend.output={...digested,tail:'\ufffd'.repeat(PROJECT.tailBytes)};
  for(let i=0;i<PROJECT.runs;i++) {runner.run(credentials);assert.equal((await settled(runner,credentials)).state,'exited');}
  assert.equal(store.read(`project-session-${credentials.projectId}.json`).runs.length,PROJECT.runs);
  assert.throws(()=>runner.run(credentials),{message:'attempt-limit'});
  const flood=outputDigest();flood.update(Buffer.alloc(PROJECT.outputBytes+1));
  assert.deepEqual([flood.full(),flood.result(false,null).truncated],[true,true]);
});

test('P09: a container that never started is not reported as a passed run', async t => {
  const {runner,backend,claim}=await setup(t);
  const credentials=access(runner.create(claim().input));
  backend.started=false;runner.run(credentials);
  const run=await settled(runner,credentials);
  assert.deepEqual([run.state,run.reason,run.exitCode],['error','target-not-started',null]);
  backend.started=true;backend.exitCode=0;backend.stream=async function(){this.current.State.ExitCode=0;this.current.State.Status='exited';return {...this.output,exitCode:125};};
  runner.run(credentials);
  assert.deepEqual((await settled(runner,credentials)).reason,'exit-status-mismatch');
});

test('P12: a socket inside the project directory stops the run before start', async t => {
  const {runner,backend,claim,projectDir}=await setup(t);
  const credentials=access(runner.create(claim().input));
  const server=createServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(join(projectDir,'s'),resolve);});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  let started=false;backend.stream=async()=>{started=true;return {...backend.output,exitCode:0};};
  runner.run(credentials);
  const run=await settled(runner,credentials);
  assert.deepEqual([run.state,run.reason,started,backend.current],['error','project-directory-special-file',false,null]);
});
