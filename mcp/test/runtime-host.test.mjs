import test from 'node:test';
import assert from 'node:assert/strict';
import { daemonIsolation, enforceHost } from '../dist/docker.js';
import { objectHash } from '../dist/policy.js';

export function host(patch = {}) {
  return {OSType:'linux',Architecture:'aarch64',CgroupVersion:'2',MemoryLimit:true,PidsLimit:true,CpuCfsQuota:true,SecurityOptions:['name=seccomp,profile=builtin'],Runtimes:{runc:{path:'runc'},runsc:{path:'/usr/local/bin/runsc',runtimeArgs:[]},kata:{}},...patch};
}

test('G01/G02/G04: a registered runtime selects only a supported native Linux platform', () => {
  for(const [architecture,platform] of [['arm64','linux/arm64'],['aarch64','linux/arm64'],['amd64','linux/amd64'],['x86_64','linux/amd64']]) {
    for(const runtime of ['runc','runsc','kata']) {
      const info=host({Architecture:architecture});
      assert.deepEqual(enforceHost(info,runtime),{platform,runtimeConfigHash:objectHash(info.Runtimes[runtime])});
    }
  }
  assert.deepEqual(enforceHost(host()),enforceHost(host(),'runc'),'Existing callers select runc, not the daemon default');
  for(const patch of [{Architecture:'riscv64'},{OSType:'windows'},{CgroupVersion:'1'},{MemoryLimit:false},{PidsLimit:false},{CpuCfsQuota:false},{SecurityOptions:[]}]) assert.throws(()=>enforceHost(host(patch),'runsc'));
  for(const runtime of ['runc','runsc','kata']) {
    const info=host();delete info.Runtimes[runtime];
    assert.throws(()=>enforceHost(info,runtime),/runtime-unavailable/);
  }
  assert.throws(()=>enforceHost(host(),'untrusted-runtime'));
  for(const runtime of ['runc','runsc']) assert.throws(()=>enforceHost(host({Runtimes:{[runtime]:{}}}),runtime),/runtime-unavailable/);
  assert.deepEqual(daemonIsolation(host()),{rootless:false,userns:false});
  assert.deepEqual(daemonIsolation(host({SecurityOptions:['name=seccomp,profile=builtin','name=rootless','name=userns']})),{rootless:true,userns:true});
});
