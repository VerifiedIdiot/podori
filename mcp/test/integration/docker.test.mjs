import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { prepared, save } from '../helpers.mjs';

test('A4/A7: the actual container enforces controls and serves normal HTTP requests', async () => {
  assert.ok(existsSync('dist/docker.js'), 'The bounded Docker backend is absent');
  const { DockerBackend, enforceHost, enforceContainer, enforceProbe } = await import('../../dist/docker.js');
  const {dir,config}=await prepared('isolation');
  const backend=new DockerBackend(config,dir);
  const id=randomUUID();
  try {
    const actual=await backend.provision(id, () => {});
    save('actual-isolation',actual);
    enforceHost(actual.host,config.runtime);
    enforceContainer(actual.inspection,config,backend.name(id));
    enforceProbe(actual.probe,config,actual.hostControls,actual.inspection);
    assert.equal(actual.inspection.HostConfig.Runtime,config.runtime);
    assert.equal(actual.hostControls?.source ?? null,{runsc:'native-linux-cgroup-v2',kata:'native-linux-kvm'}[config.runtime] ?? null);
    assert.equal(actual.probe.uid,1000);
    assert.equal(actual.probe.rootWrite,'EROFS');
    assert.equal(actual.probe.egress4.connected,false);
    assert.equal(actual.probe.egress6.connected,false);
    assert.equal(actual.probe.dockerSocket.connected,false);
    assert.deepEqual(actual.probe.interfaces,['lo']);
    assert.deepEqual(actual.states.vulnerable.response.body,actual.states.fixed.response.body);
    const result=await backend.observe(id,'authorization');
    save('normal-http',result);
    assert.equal(result.vulnerable.normal.response.status,200);
    assert.equal(result.fixed.normal.response.status,200);
    for(const key of ['MemoryLimit','PidsLimit','CpuCfsQuota']) assert.throws(() => enforceHost({...actual.host,[key]:false}));
    assert.throws(() => enforceHost({...actual.host,SecurityOptions:[]}));
    for(const [field,value] of [['Runtime',config.runtime==='runsc'?'runc':'runsc'],['NetworkMode','bridge'],['ReadonlyRootfs',false],['Memory',0],['PidsLimit',0],['NanoCpus',0],['Binds',['/tmp:/host']]]) {
      assert.throws(() => enforceContainer({...actual.inspection,HostConfig:{...actual.inspection.HostConfig,[field]:value}},config,backend.name(id)));
    }
    assert.throws(() => enforceProbe({...actual.probe,egress4:{connected:true}},config,actual.hostControls,actual.inspection));
    if(config.runtime==='runc')assert.throws(() => enforceProbe({...actual.probe,seccomp:0}));
    else {
      assert.throws(() => enforceProbe(actual.probe,config,null,actual.inspection));
      assert.throws(() => enforceProbe(actual.probe,config,{...actual.hostControls,seccomp:0},actual.inspection));
      assert.throws(() => enforceProbe(actual.probe,config,{...actual.hostControls,memoryMax:'max'},actual.inspection));
    }
    const absent = new DockerBackend({...config,imageId:`sha256:${'0'.repeat(64)}`},dir);
    await assert.rejects(absent.preflight());
  } finally {
    await backend.remove(id);
    assert.equal(await backend.inspect(id),null);
    save('owned-after',await backend.owned());
    assert.deepEqual(await backend.owned(),[]);
  }
});
