import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { BUDGET, objectHash } from '../dist/policy.js';
import { fixtureRevision } from '../dist/docker.js';

export function host(patch = {}) {
  return {OSType:'linux',Architecture:'aarch64',CgroupVersion:'2',MemoryLimit:true,PidsLimit:true,CpuCfsQuota:true,SecurityOptions:['name=seccomp,profile=builtin'],Runtimes:{runc:{path:'runc'},runsc:{path:'/usr/local/bin/runsc',runtimeArgs:[]},kata:{runtimeType:'/opt/kata/bin/containerd-shim-kata-v2'}},...patch};
}
export function configuration(patch = {}) {
  const runtime=patch.runtime ?? 'runc';
  return {version:2,owner:'98b46a1d-ab2e-445a-85e9-8a6a60eaf026',endpoint:'unix:///local/docker.sock',runtime,runtimeConfigHash:objectHash(host().Runtimes[runtime]),platform:'linux/arm64',imageId:`sha256:${'a'.repeat(64)}`,fixtureRevision:fixtureRevision(),budget:BUDGET,...patch};
}
export function image(config, patch = {}) {
  return {Id:config.imageId,Os:'linux',Architecture:config.platform.split('/')[1],RootFS:{Layers:Array(6).fill('sha256:layer')},Config:{Labels:{'io.podori.fixture':config.fixtureRevision}},...patch};
}
export async function socketFixture(t) {
  const root=mkdtempSync(join(process.env.PODORI_EVIDENCE_DIR,'s-'));
  const path=join(root,'d.sock'),server=createServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(path,resolve);});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return {root,endpoint:`unix://${path}`};
}
export function inspection(config, id, running=true) {
  return {Id:'f'.repeat(64),Name:`/podori-${config.owner}-${id}`,Image:config.imageId,Platform:'linux',
    Config:{User:'1000:1000',Env:[`PODORI_EXPERIMENT_ID=${id}`],Labels:{'io.podori.controller':config.owner,'io.podori.experiment':id,'io.podori.fixture':config.fixtureRevision},Entrypoint:['/usr/bin/timeout','--signal=KILL',String(BUDGET.lifetimeSeconds),'/usr/local/bin/node','/fixture/app.mjs'],Cmd:[]},
    HostConfig:{Runtime:config.runtime,NetworkMode:'none',ReadonlyRootfs:true,Privileged:false,CapDrop:['ALL'],CapAdd:null,SecurityOpt:['no-new-privileges'],Memory:BUDGET.memory,MemorySwap:BUDGET.memory,NanoCpus:BUDGET.cpu*1e9,PidsLimit:BUDGET.pids,Tmpfs:{'/tmp':`rw,noexec,nosuid,nodev,size=${BUDGET.tmpfs},mode=1777`},Binds:null,RestartPolicy:{Name:'no'},PortBindings:{},LogConfig:{Type:'none'}},Mounts:[],State:{Pid:123,Running:running,ExitCode:0,OOMKilled:false,Status:running?'running':'created'}};
}
export function probe(patch = {}) {
  return {uid:1000,capEff:'0000000000000000',noNewPrivs:1,seccomp:2,rootWrite:'EROFS',tmpWrite:true,interfaces:['lo'],memoryMax:String(BUDGET.memory),pidsMax:String(BUDGET.pids),cpuMax:'50000 100000',tmpMount:'tmpfs /tmp tmpfs rw,nosuid,nodev,noexec,size=4096k 0 0',tmpLimit:{error:'ENOSPC',bytes:BUDGET.tmpfs},egress4:{connected:false,code:'ENETUNREACH'},egress6:{connected:false,code:'ENETUNREACH'},dockerSocket:{connected:false,code:'ENOENT'},alternateSocket:{connected:false,code:'ENOENT'},...patch};
}
export function hostEvidence(config, actual) {
  return {source:'native-linux-cgroup-v2',runtime:config.runtime,runtimeConfigHash:config.runtimeConfigHash,platform:config.platform,containerId:actual.Id,pid:actual.State.Pid,cgroupPath:`/system.slice/docker-${actual.Id}.scope`,members:[actual.State.Pid],memoryMax:String(BUDGET.memory),memorySwapMax:'0',pidsMax:String(BUDGET.pids),cpuMax:'50000 100000',seccomp:2,noNewPrivs:1,processStart:'100',capturedAt:new Date().toISOString()};
}
export function vmEvidence(config, actual) {
  return {source:'native-linux-kvm',runtime:config.runtime,runtimeConfigHash:config.runtimeConfigHash,platform:config.platform,containerId:actual.Id,pid:actual.State.Pid,processStart:'100',capturedAt:new Date().toISOString()};
}
