import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('G07: CI selects only the literal runtime and expected native architecture', () => {
  for(const runtime of [undefined,'runc','runsc','kata']) for(const arch of [undefined,'arm64','amd64']) {
    const env={...process.env};delete env.PODORI_TEST_RUNTIME;delete env.PODORI_EXPECTED_ARCH;
    if(runtime)env.PODORI_TEST_RUNTIME=runtime;
    if(arch)env.PODORI_EXPECTED_ARCH=arch;
    const result=spawnSync(process.execPath,['--input-type=module','-e',"const h=await import('./test/helpers.mjs');console.log(JSON.stringify({runtime:h.testRuntime,platform:h.expectedPlatform??null}));"],{env,encoding:'utf8',timeout:3000});
    assert.equal(result.status,0,result.stderr);
    assert.deepEqual(JSON.parse(result.stdout),{runtime:runtime??'runc',platform:arch?`linux/${arch}`:null});
  }
  for(const patch of [{PODORI_TEST_RUNTIME:'other'},{PODORI_EXPECTED_ARCH:'386'}]) {
    const result=spawnSync(process.execPath,['--input-type=module','-e',"await import('./test/helpers.mjs');"],{env:{...process.env,...patch},encoding:'utf8',timeout:3000});
    assert.notEqual(result.status,0);
  }
});
