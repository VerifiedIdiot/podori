import test from 'node:test';
import assert from 'node:assert/strict';
import * as hostControls from '../dist/host-evidence.js';
import { configuration, inspection } from './runtime-helpers.mjs';
import { BUDGET } from '../dist/policy.js';

const id='ed775a7d-1eb9-46b6-81c1-cecb9503eff9';
function source(actual, arch='arm64') {
  const group=`/system.slice/docker-${actual.Id}.scope`,base=`/sys/fs/cgroup${group}`,pid=actual.State.Pid;
  const stat=`${pid} (runsc-sandbox) S `+Array.from({length:19},(_,i)=>i===18?'100':'0').join(' ');
  const files=new Map([[`/proc/${pid}/stat`,stat],[`/proc/${pid}/cgroup`,`0::${group}`],[`/proc/${pid}/status`,'Name:\trunsc-sandbox\nNoNewPrivs:\t1\nSeccomp:\t2\n'],[`${base}/cgroup.procs`,String(pid)],[`${base}/memory.max`,String(BUDGET.memory)],[`${base}/memory.swap.max`,'0'],[`${base}/pids.max`,String(BUDGET.pids)],[`${base}/cpu.max`,'50000 100000']]);
  const reads=[];
  return {files,reads,host:{os:'linux',arch,realpath:path=>path,read:path=>{reads.push(path);if(!files.has(path))throw new Error('missing-host-file');return files.get(path);}}};
}

test('G06: collect native runsc cgroup and sentry evidence from the inspected PID, never the guest', () => {
  assert.equal(typeof hostControls.collectHostControls,'function','Native host evidence collection is absent');
  for(const [arch,platform] of [['arm64','linux/arm64'],['x64','linux/amd64']]) {
    const config=configuration({runtime:'runsc',platform}),actual=inspection(config,id),s=source(actual,arch);
    const result=hostControls.collectHostControls(config,actual,s.host);
    assert.equal(result.source,'native-linux-cgroup-v2');assert.equal(result.containerId,actual.Id);
    assert.equal(result.pid,actual.State.Pid);assert.equal(result.processStart,'100');assert.equal(result.runtimeConfigHash,config.runtimeConfigHash);
    assert.equal(result.memoryMax,String(BUDGET.memory));assert.equal(result.pidsMax,String(BUDGET.pids));
    assert.equal(result.seccomp,2);assert.ok(s.reads.every(path=>path.startsWith('/proc/123/') || path.startsWith('/sys/fs/cgroup/')));
    for(const patch of [{os:'darwin'},{arch:'riscv64'},{arch:arch==='arm64'?'x64':'arm64'}]) assert.throws(()=>hostControls.collectHostControls(config,actual,{...s.host,...patch}),/native-host-evidence-unavailable/);
    for(const path of s.files.keys()) {
      const missing=source(actual,arch);missing.files.delete(path);
      assert.throws(()=>hostControls.collectHostControls(config,actual,missing.host));
    }
    for(const value of ['0::/','0::/system.slice/unrelated.scope',`0::/../docker-${actual.Id}.scope`,`0::/docker-${actual.Id}.scope/../elsewhere`,'1:memory:/old']) {
      const bad=source(actual,arch);bad.files.set('/proc/123/cgroup',value);
      assert.throws(()=>hostControls.collectHostControls(config,actual,bad.host));
    }
    assert.throws(()=>hostControls.collectHostControls(config,actual,{...s.host,realpath:path=>path+'-redirected'}));
    const moved=source(actual,arch);let readCount=0;
    const originalRead=moved.host.read;
    moved.host.read=path=>path==='/proc/123/stat' && ++readCount>1?'123 (other) S '+Array(19).fill('2').join(' '):originalRead(path);
    assert.throws(()=>hostControls.collectHostControls(config,actual,moved.host),/host-process-changed/);
    const bad=source(actual,arch);bad.files.set('/proc/123/status','NoNewPrivs:\t1\nSeccomp:\t0\n');
    assert.throws(()=>hostControls.collectHostControls(config,actual,bad.host),/host-controls-mismatch/);
  }
});

test('G06: collect KVM evidence only from the inspected PID that Kata named for the container', () => {
  const config=configuration({runtime:'kata'}),actual=inspection(config,id),pid=actual.State.Pid;
  const stat=`${pid} (qemu-system-x86) S `+Array.from({length:19},(_,i)=>i===18?'100':'0').join(' ');
  const command=['/opt/kata/bin/qemu-system-x86_64','-name',`sandbox-${actual.Id}`,'-machine','q35,accel=kvm,nvdimm=on',''];
  const reader=(args=command,status=stat)=>({os:'linux',arch:'arm64',realpath:path=>path,read:path=>{
    if(path===`/proc/${pid}/stat`)return status;
    if(path===`/proc/${pid}/cmdline`)return args.join('\0');
    throw new Error('missing-host-file');
  }});
  const result=hostControls.collectVm(config,actual,reader());
  assert.equal(result.source,'native-linux-kvm');assert.equal(result.containerId,actual.Id);assert.equal(result.pid,pid);assert.equal(result.processStart,'100');
  for(const patch of [{os:'darwin'},{arch:'x64'}]) assert.throws(()=>hostControls.collectVm(config,actual,{...reader(),...patch}),/native-host-evidence-unavailable/);
  assert.throws(()=>hostControls.collectVm(configuration({runtime:'runsc'}),actual,reader()),/native-host-evidence-unavailable/);
  for(const args of [['/usr/bin/sleep','45'],command.map(x=>x.replace('accel=kvm','accel=tcg')),command.map(x=>x.replace(actual.Id,'e'.repeat(64))),['qemu','-name',`not-sandbox-${actual.Id}`,'-machine','q35,accel=kvm']]) assert.throws(()=>hostControls.collectVm(config,actual,reader(args)),/vm-evidence-mismatch/);
  let reads=0;const moved=reader();const read=moved.read;
  moved.read=path=>path===`/proc/${pid}/stat` && ++reads>1?stat.replace(' 100',' 200'):read(path);
  assert.throws(()=>hostControls.collectVm(config,actual,moved),/host-process-changed/);
});
