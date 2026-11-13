import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { configuration, host, image, socketFixture } from './runtime-helpers.mjs';
import { BASE_IMAGE, authorize } from '../dist/policy.js';

// This command seam records CLI arguments. It never contacts a Docker daemon.
const stub=`#!${process.execPath}
import {readFileSync,appendFileSync} from 'node:fs';
import {join} from 'node:path';
const root=process.env.HOME,args=process.argv.slice(4);
const data=JSON.parse(readFileSync(join(root,'responses.json'),'utf8'));
appendFileSync(join(root,'calls.jsonl'),JSON.stringify(args)+'\\n');
let out;
if(args[0]==='info')out=data.host;
else if(args[0]==='image' && args[1]==='inspect')out=[args[2]===data.baseName?data.base:data.image];
else if(args[0]==='build')out='built-fixture';
else throw new Error('unexpected-command');
process.stdout.write(typeof out==='string'?out:JSON.stringify(out));
`;

async function fixture(t) {
  const {root,endpoint}=await socketFixture(t);
  const bin=join(root,'bin');mkdirSync(bin,{mode:0o700});
  writeFileSync(join(bin,'docker'),stub,{mode:0o700});
  const env={...process.env,PATH:`${bin}:${process.env.PATH}`};
  const call=args=>spawnSync(process.execPath,['dist/host.js',...args],{env,encoding:'utf8',timeout:15000});
  let serial=0;
  function state(architecture='aarch64',runtime='runc',patch={}) {
    const dir=join(root,`state-${serial++}`);mkdirSync(dir,{mode:0o700});
    const platform=['arm64','aarch64'].includes(architecture)?'linux/arm64':'linux/amd64';
    const config=configuration({endpoint,runtime,platform});
    const data={host:host({Architecture:architecture}),baseName:BASE_IMAGE,base:{Os:'linux',Architecture:platform.split('/')[1],RootFS:{Layers:Array(5).fill('layer')},Config:{Env:['NODE_VERSION=24.22.0']}},image:image(config),...patch};
    writeFileSync(join(dir,'responses.json'),JSON.stringify(data),{mode:0o600});
    return {dir,data,config};
  }
  const calls=dir=>readFileSync(join(dir,'calls.jsonl'),'utf8').trim().split('\n').map(x=>JSON.parse(x));
  return {root,endpoint,call,state,calls};
}

test('G01/G02/G03: host prepare and approve bind explicit runtime and native build platform', async t => {
  const f=await fixture(t);
  for(const architecture of ['aarch64','x86_64']) for(const selection of [undefined,'--runtime=runc','--runtime=runsc','--runtime=kata']) {
    const runtime=selection?.slice('--runtime='.length) ?? 'runc';
    const {dir,config}=f.state(architecture,runtime);
    const result=f.call(['prepare',dir,f.endpoint,...(selection?[selection]:[])]);
    assert.equal(result.status,0,result.stderr);
    const saved=JSON.parse(readFileSync(join(dir,'policy.json'),'utf8'));
    assert.equal(saved.version,2);assert.equal(saved.runtime,runtime);
    assert.equal(saved.platform,config.platform);assert.equal(saved.runtimeConfigHash,config.runtimeConfigHash);
    const build=f.calls(dir).find(args=>args[0]==='build');
    assert.equal(build[build.indexOf('--platform')+1],config.platform);
    assert.ok(build.includes('--network=none'));assert.ok(build.includes('--pull=false'));
    const approved=f.call(['approve',dir,'report-1','auth-1','authorization',new Date(Date.now()+60_000).toISOString()]);
    assert.equal(approved.status,0,approved.stderr);
    const {approvalId,capabilityFile}=JSON.parse(approved.stdout);
    const grant=JSON.parse(readFileSync(join(dir,`grant-${approvalId}.json`),'utf8'));
    const token=JSON.parse(readFileSync(join(dir,capabilityFile),'utf8')).claimToken;
    assert.equal(authorize(grant,saved,token).runtime,runtime);
    assert.equal(grant.platform,config.platform);assert.equal(grant.runtimeConfigHash,config.runtimeConfigHash);
  }
});

test('G01/G02/G04: preparation rejects absent runtimes, image mismatches and arbitrary runtime arguments without fallback', async t => {
  const f=await fixture(t);
  for(const selection of ['--runtime=other','--runtime=runsc --network=host','--runtime','--platform=linux/amd64']) {
    const {dir}=f.state();
    const result=f.call(['prepare',dir,f.endpoint,selection]);
    assert.equal(result.status,1);assert.match(result.stderr,/invalid-host-command/);
    assert.equal(existsSync(join(dir,'calls.jsonl')),false);assert.equal(existsSync(join(dir,'policy.json')),false);
  }
  for(const fault of ['missing-runtime','unknown-architecture','base-mismatch','fixture-mismatch']) {
    const {dir,data}=f.state('x86_64','runsc');
    if(fault==='missing-runtime')delete data.host.Runtimes.runsc;
    if(fault==='unknown-architecture')data.host.Architecture='riscv64';
    if(fault==='base-mismatch')data.base.Architecture='arm64';
    if(fault==='fixture-mismatch')data.image.Architecture='arm64';
    writeFileSync(join(dir,'responses.json'),JSON.stringify(data),{mode:0o600});
    const result=f.call(['prepare',dir,f.endpoint,'--runtime=runsc']);
    assert.equal(result.status,1);assert.equal(existsSync(join(dir,'policy.json')),false);
    if(fault!=='fixture-mismatch')assert.equal(f.calls(dir).some(args=>args[0]==='build'),false);
    assert.equal(f.calls(dir).some(args=>args[0]==='container'),false);
  }
});
