import test from 'node:test';
import assert from 'node:assert/strict';
import { Approval, authorize, BUDGET, Config, digest } from '../dist/policy.js';

export function configuration(patch = {}) {
  return {version:2,owner:'98b46a1d-ab2e-445a-85e9-8a6a60eaf026',endpoint:'unix:///local/docker.sock',runtime:'runc',runtimeConfigHash:'d'.repeat(64),platform:'linux/arm64',imageId:`sha256:${'a'.repeat(64)}`,fixtureRevision:'b'.repeat(64),budget:BUDGET,...patch};
}

test('G03/G04: policy and approval bind runtime registration and native platform with no legacy migration', () => {
  const token='c'.repeat(64);
  for(const runtime of ['runc','runsc','kata']) for(const platform of ['linux/arm64','linux/amd64']) {
    const config=configuration({runtime,platform});
    assert.equal(Config.safeParse(config).success,true,'The selected runtime and platform need a strict policy');
    const approval={version:2,id:'ed775a7d-1eb9-46b6-81c1-cecb9503eff9',reportId:'report-1',itemId:'auth-1',target:'synthetic-http-v1',scenario:'authorization',runtime,runtimeConfigHash:config.runtimeConfigHash,platform,fixtureRevision:config.fixtureRevision,imageId:config.imageId,budget:BUDGET,expiresAt:new Date(Date.now()+60_000).toISOString(),claimHash:digest(token)};
    assert.equal(authorize(approval,config,token).runtime,runtime);
    for(const patch of [{runtime:runtime==='runc'?'runsc':'runc'},{runtimeConfigHash:'e'.repeat(64)},{platform:platform==='linux/arm64'?'linux/amd64':'linux/arm64'}]) {
      assert.throws(()=>authorize({...approval,...patch},config,token),/scope-mismatch/);
    }
    for(const value of [undefined,1]) {
      assert.equal(Config.safeParse({...config,version:value}).success,false);
      assert.equal(Approval.safeParse({...approval,version:value}).success,false);
    }
    for(const field of ['runtime','runtimeConfigHash','platform']) {
      const oldConfig={...config};delete oldConfig[field];
      const oldApproval={...approval};delete oldApproval[field];
      assert.equal(Config.safeParse(oldConfig).success,false);
      assert.equal(Approval.safeParse(oldApproval).success,false);
    }
    for(const patch of [{runtime:'other'},{platform:'linux/386'},{runtimeArgs:['--network=host']}]) assert.equal(Config.safeParse({...config,...patch}).success,false);
  }
});
