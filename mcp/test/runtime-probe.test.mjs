import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceProbe } from '../dist/docker.js';
import { BUDGET } from '../dist/policy.js';
import { configuration, inspection, probe, hostEvidence, vmEvidence } from './runtime-helpers.mjs';

const id='ed775a7d-1eb9-46b6-81c1-cecb9503eff9';

test('G06: runc retains every existing guest isolation check', () => {
  assert.doesNotThrow(()=>enforceProbe(probe({rootWrite:'EROFS'})));
  for(const patch of [{uid:0},{capEff:'1'},{noNewPrivs:0},{seccomp:0},{rootWrite:'EACCES'},{rootWrite:'unexpected-success'},{tmpWrite:false},{interfaces:['lo','eth0']},{memoryMax:'max'},{pidsMax:'max'},{cpuMax:'max 100000'},{tmpMount:'tmpfs /tmp tmpfs rw,size=8m'},{egress4:{connected:true}},{egress6:{connected:true}},{dockerSocket:{connected:true}},{alternateSocket:{connected:true}},{dockerSocket:{connected:false,code:'EACCES'}},{alternateSocket:{connected:false,code:'EACCES'}}]) assert.throws(()=>enforceProbe(probe(patch)));
});

test('G06: runsc uses bound native host controls, not virtual guest cgroups or seccomp', () => {
  const config=configuration({runtime:'runsc'}),actual=inspection(config,id),evidence=hostEvidence(config,actual);
  const virtual=probe({rootWrite:'EROFS',seccomp:0,noNewPrivs:0,memoryMax:null,pidsMax:null,cpuMax:null,tmpMount:'none /tmp tmpfs rw 0 0',tmpLimit:{error:'ENOSPC',bytes:BUDGET.tmpfs}});
  assert.doesNotThrow(()=>enforceProbe(virtual,config,evidence,actual));
  assert.throws(()=>enforceProbe(virtual));
  for(const missing of [undefined,null,{}, {...evidence,source:'guest'}]) assert.throws(()=>enforceProbe(virtual,config,missing,actual));
  for(const patch of [{runtime:'runc'},{runtimeConfigHash:'e'.repeat(64)},{platform:'linux/amd64'},{containerId:'e'.repeat(64)},{pid:124},{members:[]},{cgroupPath:'/system.slice/other.scope'},{memoryMax:'max'},{memorySwapMax:'max'},{pidsMax:'max'},{cpuMax:'max 100000'},{seccomp:0},{noNewPrivs:0}]) assert.throws(()=>enforceProbe(virtual,config,{...evidence,...patch},actual));
  for(const patch of [{uid:0},{capEff:'1'},{rootWrite:'EACCES'},{rootWrite:'unexpected-success'},{tmpWrite:false},{interfaces:['lo','eth0']},{egress4:{connected:true}},{egress6:{connected:true}},{dockerSocket:{connected:false,code:'EACCES'}},{alternateSocket:{connected:true}},{tmpLimit:{error:'unexpected-success',bytes:BUDGET.tmpfs+1}},{tmpLimit:{error:'ENOSPC',bytes:BUDGET.tmpfs+1}}]) assert.throws(()=>enforceProbe({...virtual,...patch},config,evidence,actual));
});

test('G06: kata requires bound KVM evidence and guest controls without the guest PID limit', () => {
  const config=configuration({runtime:'kata'}),actual=inspection(config,id),evidence=vmEvidence(config,actual);
  const guest=probe({pidsMax:'max'});
  assert.doesNotThrow(()=>enforceProbe(guest,config,evidence,actual));
  assert.throws(()=>enforceProbe(guest),'runc keeps the PID limit');
  for(const missing of [undefined,null,{},{...evidence,source:'native-linux-cgroup-v2'}]) assert.throws(()=>enforceProbe(guest,config,missing,actual));
  for(const patch of [{runtime:'runc'},{runtimeConfigHash:'e'.repeat(64)},{platform:'linux/amd64'},{containerId:'e'.repeat(64)},{pid:124}]) assert.throws(()=>enforceProbe(guest,config,{...evidence,...patch},actual));
  for(const patch of [{uid:0},{capEff:'1'},{noNewPrivs:0},{seccomp:0},{rootWrite:'EACCES'},{interfaces:['lo','eth0']},{memoryMax:'max'},{cpuMax:'max 100000'},{tmpMount:'tmpfs /tmp tmpfs rw,size=8m'},{egress4:{connected:true}},{dockerSocket:{connected:true}}]) assert.throws(()=>enforceProbe({...guest,...patch},config,evidence,actual));
});
