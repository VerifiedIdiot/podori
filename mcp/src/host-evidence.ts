import { z } from 'zod';
import { constants, openSync, closeSync, readSync, realpathSync } from 'node:fs';
import { BUDGET, Hash, Platform, type Configuration } from './policy.js';
import type { ContainerInspection } from './docker.js';

const HostControls = z.strictObject({
  source:z.literal('native-linux-cgroup-v2'),runtime:z.literal('runsc'),runtimeConfigHash:Hash,platform:Platform,
  containerId:Hash,pid:z.number().int().min(2),cgroupPath:z.string().max(1024),members:z.array(z.number().int().min(2)).max(BUDGET.pids),
  memoryMax:z.string(),memorySwapMax:z.string(),pidsMax:z.string(),cpuMax:z.string(),seccomp:z.number(),noNewPrivs:z.number(),
  processStart:z.string().regex(/^\d+$/),capturedAt:z.iso.datetime(),
});
export type HostControlEvidence = z.infer<typeof HostControls>;

export function boundCgroup(path:string, containerId:string):boolean {
  const parts=path.slice(1).split('/');
  return /^[a-f0-9]{64}$/.test(containerId) && /^\/[A-Za-z0-9_./-]+$/.test(path) && parts.every(p=>p!=='' && p!=='.' && p!=='..') && parts.some(p=>p===containerId || p===`docker-${containerId}.scope`);
}

export function enforceHostControls(input:unknown, config:Configuration, inspection:ContainerInspection|undefined):HostControlEvidence {
  const h=HostControls.parse(input);
  if(!inspection?.State.Running || h.runtime!==config.runtime || h.runtimeConfigHash!==config.runtimeConfigHash || h.platform!==config.platform || h.containerId!==inspection.Id || h.pid!==inspection.State.Pid || !h.members.includes(h.pid) || !boundCgroup(h.cgroupPath,h.containerId))throw new Error('host-evidence-identity-mismatch');
  if(h.memoryMax!==String(BUDGET.memory) || h.memorySwapMax!=='0' || h.pidsMax!==String(BUDGET.pids) || h.cpuMax!=='50000 100000' || h.seccomp!==2 || h.noNewPrivs!==1)throw new Error('host-controls-mismatch');
  return h;
}

type HostReader = {os:string;arch:string;read:(path:string)=>string;realpath:(path:string)=>string};
function readBounded(path:string):string {
  const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {
    const buffer=Buffer.alloc(BUDGET.outputBytes+1),size=readSync(fd,buffer,0,buffer.length,null);
    if(size>BUDGET.outputBytes)throw new Error('host-evidence-size-limit');
    return buffer.subarray(0,size).toString('utf8').trim();
  } finally {closeSync(fd);}
}

export function collectHostControls(config:Configuration, inspection:ContainerInspection, host:HostReader={os:process.platform,arch:process.arch,read:readBounded,realpath:realpathSync}):HostControlEvidence {
  const platform=host.arch==='arm64'?'linux/arm64':host.arch==='x64'?'linux/amd64':null;
  if(host.os!=='linux' || platform!==config.platform || config.runtime!=='runsc')throw new Error('native-host-evidence-unavailable');
  const pid=z.number().int().min(2).parse(inspection.State.Pid),proc=`/proc/${pid}`;
  const read=(path:string):string=>{
    let value:string;
    try {value=host.read(path);}catch {throw new Error('native-host-evidence-unavailable');}
    if(Buffer.byteLength(value)>BUDGET.outputBytes)throw new Error('host-evidence-size-limit');
    return value.trim();
  };
  const start=():string=>{
    const stat=read(`${proc}/stat`);
    return z.string().regex(/^\d+$/).parse(stat.slice(stat.lastIndexOf(')')+2).split(' ')[22-3]);
  };
  const processStart=start(),group=read(`${proc}/cgroup`),cgroupPath=group.match(/^0::(\/[^\n]+)$/)?.[1];
  if(!cgroupPath || !boundCgroup(cgroupPath,inspection.Id))throw new Error('host-evidence-identity-mismatch');
  const base=`/sys/fs/cgroup${cgroupPath}`;
  if(host.realpath(base)!==base)throw new Error('host-evidence-identity-mismatch');
  const status=read(`${proc}/status`);
  const members=read(`${base}/cgroup.procs`).split(/\s+/).filter(Boolean).map(Number);
  const evidence={source:'native-linux-cgroup-v2',runtime:config.runtime,runtimeConfigHash:config.runtimeConfigHash,platform:config.platform,containerId:inspection.Id,pid,cgroupPath,members,
    memoryMax:read(`${base}/memory.max`),memorySwapMax:read(`${base}/memory.swap.max`),pidsMax:read(`${base}/pids.max`),cpuMax:read(`${base}/cpu.max`),
    seccomp:Number(status.match(/^Seccomp:\s*(\d+)$/m)?.[1]),noNewPrivs:Number(status.match(/^NoNewPrivs:\s*(\d+)$/m)?.[1]),processStart,capturedAt:new Date().toISOString()};
  if(start()!==processStart || read(`${proc}/cgroup`)!==group)throw new Error('host-process-changed');
  return enforceHostControls(evidence,config,inspection);
}

const VmEvidence = z.strictObject({
  source:z.literal('native-linux-kvm'),runtime:z.literal('kata'),runtimeConfigHash:Hash,platform:Platform,
  containerId:Hash,pid:z.number().int().min(2),processStart:z.string().regex(/^\d+$/),capturedAt:z.iso.datetime(),
});
export type VmEvidence = z.infer<typeof VmEvidence>;

export function enforceVm(input:unknown, config:Configuration, inspection:ContainerInspection|undefined):VmEvidence {
  const v=VmEvidence.parse(input);
  if(!inspection?.State.Running || v.runtime!==config.runtime || v.runtimeConfigHash!==config.runtimeConfigHash || v.platform!==config.platform || v.containerId!==inspection.Id || v.pid!==inspection.State.Pid)throw new Error('host-evidence-identity-mismatch');
  return v;
}

// The inspected PID must be the KVM process that Kata named for this container.
export function collectVm(config:Configuration, inspection:ContainerInspection, host:HostReader={os:process.platform,arch:process.arch,read:readBounded,realpath:realpathSync}):VmEvidence {
  const platform=host.arch==='arm64'?'linux/arm64':host.arch==='x64'?'linux/amd64':null;
  if(host.os!=='linux' || platform!==config.platform || config.runtime!=='kata')throw new Error('native-host-evidence-unavailable');
  const pid=z.number().int().min(2).parse(inspection.State.Pid),proc=`/proc/${pid}`;
  const read=(path:string):string=>{
    try {return host.read(path);}catch {throw new Error('native-host-evidence-unavailable');}
  };
  const start=():string=>{
    const stat=read(`${proc}/stat`);
    return z.string().regex(/^\d+$/).parse(stat.slice(stat.lastIndexOf(')')+2).split(' ')[22-3]);
  };
  const processStart=start(),args=read(`${proc}/cmdline`).split('\0');
  if(!/^[a-f0-9]{64}$/.test(inspection.Id) || !args.includes(`sandbox-${inspection.Id}`) || !args.some(arg=>arg.split(',').includes('accel=kvm')))throw new Error('vm-evidence-mismatch');
  if(start()!==processStart)throw new Error('host-process-changed');
  return enforceVm({source:'native-linux-kvm',runtime:config.runtime,runtimeConfigHash:config.runtimeConfigHash,platform:config.platform,containerId:inspection.Id,pid,processStart,capturedAt:new Date().toISOString()},config,inspection);
}
