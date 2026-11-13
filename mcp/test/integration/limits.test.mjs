import test from 'node:test';
import assert from 'node:assert/strict';
import { prepared, save, pause, waitUntil, testRuntime } from '../helpers.mjs';
import { approval, connectClient, ready, access } from '../mcp-client.mjs';
import { DockerBackend } from '../../dist/docker.js';
import { Controller } from '../../dist/controller.js';
import { BUDGET } from '../../dist/policy.js';

// A Kata guest boots and reports its exit a few seconds later than a container.
const vm=testRuntime==='kata';
const dead=pid=>{try{process.kill(pid,0);return false;}catch(error){return error.code==='ESRCH';}};

test('A8/A9: expiry denies new execution but permits evidence, cancellation and disposal', async () => {
  const {dir,config}=await prepared('expiry');
  const expires=Date.now()+(vm?9000:3500);
  const grant=approval(dir,'authorization','expiry',new Date(expires).toISOString());
  const {client,call}=await connectClient(dir),backend=new DockerBackend(config,dir);
  try {
    const credentials=access(await call('create',grant));await ready(call,credentials);
    await pause(Math.max(0,expires-Date.now())+50);
    await assert.rejects(call('run',{...credentials,scenario:'authorization'}),/approval-expired/);
    await assert.rejects(call('reset',credentials),/approval-expired/);
    const evidence=await call('evidence',credentials);save('expiry-evidence',evidence);
    assert.equal(evidence.attempts.length,0);
    assert.equal((await call('cancel',credentials)).status,'cancelled');
    assert.equal((await call('dispose',credentials)).status,'disposed');
    assert.equal(await backend.inspect(credentials.experimentId),null);
  } finally {await client.close();}
});

test('A9: the independent guest deadline stops after SIGKILL without a live controller', async () => {
  const {dir,config}=await prepared('independent-deadline');
  const grant=approval(dir);
  let connection=await connectClient(dir);
  const backend=new DockerBackend(config,dir);
  let credentials;
  try {
    credentials=access(await connection.call('create',grant));await ready(connection.call,credentials);
    const started=await backend.inspect(credentials.experimentId);save('independent-before',started);
    const pid=connection.transport.pid;process.kill(pid,'SIGKILL');await waitUntil(()=>dead(pid));await connection.client.close();
    const until=Date.parse(started.State.StartedAt)+BUDGET.lifetimeSeconds*1000+(vm?6000:1000);
    await pause(Math.max(0,until-Date.now()));
    const actual=await backend.inspect(credentials.experimentId);save('independent-after',actual);
    assert.equal(actual.State.Running,false);
    assert.equal(actual.State.ExitCode,137);
    assert.equal(actual.State.OOMKilled,false);
    connection=await connectClient(dir);
    assert.equal(await backend.inspect(credentials.experimentId),null);
    assert.equal((await connection.call('status',credentials)).status,'recovered');
  } finally {await connection.client.close();if(credentials)await backend.remove(credentials.experimentId);}
  assert.deepEqual(await backend.owned(),[]);
});

test('A10: real Docker output truncation cannot produce a verification verdict', async () => {
  const {dir,config}=await prepared('output-limit');
  const grant=approval(dir);
  class Overflow extends DockerBackend {
    async observe(id,action) {
      if(action==='authorization')return await this.command(['image','inspect',...Array(20).fill(config.imageId)]);
      return await super.observe(id,action);
    }
  }
  const backend=new Overflow(config,dir),controller=await Controller.open(dir,backend);
  try {
    const credentials=access(controller.create(grant));await waitUntil(()=>controller.status(credentials).status==='ready');
    controller.run({...credentials,scenario:'authorization'});
    await waitUntil(()=>controller.status(credentials).status==='error');
    const report=controller.evidence(credentials);save('truncated-evidence',report);
    assert.equal(report.reason,'output-truncated');assert.equal(report.attempts[0].state,'unverified');
    assert.equal(report.attempts[0].verdict.fixVerified,false);assert.equal(report.attempts[0].exitStatus,null);
    await waitUntil(async()=>await backend.inspect(credentials.experimentId)===null);
  } finally {await controller.close();}
});
