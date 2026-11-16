import { randomBytes, randomUUID } from 'node:crypto';
import { lstatSync, opendirSync, realpathSync } from 'node:fs';
import { z } from 'zod';
import { CreateInput, Hash, Id, PROJECT, ProjectAccess, ProjectApproval, digest, matchesToken, objectHash, projectScopeValid, type Configuration, type ProjectGrant } from './policy.js';
import { DockerBackend, CommandFailure, enforceHost } from './docker.js';
import { Store } from './store.js';

const OWNER = 'io.podori.project';
const RUN = 'io.podori.run';
const Inspection = z.looseObject({
  Name:z.string(), Image:z.string(),
  Config:z.looseObject({ User:z.string(), WorkingDir:z.string(), Labels:z.record(z.string(),z.string()), Entrypoint:z.array(z.string()).nullable(), Cmd:z.array(z.string()).nullable() }),
  HostConfig:z.looseObject({ Runtime:z.string(), NetworkMode:z.string(), ReadonlyRootfs:z.boolean(), Privileged:z.boolean(), CapDrop:z.array(z.string()), CapAdd:z.array(z.string()).nullable(), SecurityOpt:z.array(z.string()), Memory:z.number(), MemorySwap:z.number(), NanoCpus:z.number(), PidsLimit:z.number(), Tmpfs:z.record(z.string(),z.string()), Binds:z.array(z.string()).nullable(), RestartPolicy:z.looseObject({Name:z.string()}), PortBindings:z.unknown(), LogConfig:z.looseObject({Type:z.string()}) }),
  Mounts:z.array(z.looseObject({Type:z.string(), Destination:z.string(), Source:z.string().optional(), RW:z.boolean().optional()})),
  State:z.looseObject({Running:z.boolean(),ExitCode:z.number(),OOMKilled:z.boolean(),Status:z.string()}),
});
type ProjectInspection = z.infer<typeof Inspection>;
const Run = z.strictObject({
  id:Id, startedAt:z.iso.datetime(), finishedAt:z.iso.datetime().nullable(),
  state:z.enum(['running','exited','timed_out','cancelled','error']), reason:z.string().max(64).nullable(),
  exitCode:z.number().int().nullable(), oomKilled:z.boolean().nullable(),
  outputBytes:z.number().int().nonnegative(), outputHash:Hash.nullable(), outputTail:z.string().max(PROJECT.tailBytes*4), outputTruncated:z.boolean(),
  controls:z.unknown().nullable(),
});
const Session = z.strictObject({ id:Id, tokenHash:Hash, grant:ProjectApproval, createdAt:z.iso.datetime(), runs:z.array(Run).max(PROJECT.runs) });
type ProjectSession = z.infer<typeof Session>;
type ProjectRun = z.infer<typeof Run>;

const tmpfs=(grant:ProjectGrant):string=>`rw,nosuid,nodev,size=${grant.budget.tmpfs},mode=1777`;
function reason(error:unknown):string {
  if(error instanceof z.ZodError)return 'invalid-input';
  if(error instanceof CommandFailure)return error.reason;
  const message=error instanceof Error?error.message:'';
  return /^[a-z][a-z0-9-]{1,63}$/.test(message)?message:'operation-failed';
}
// The directory must still be the approved real path. A replaced symlink would mount another tree.
export function projectDirValid(dir:string, config:Configuration, stateRoot:string):void {
  let real:string;
  try {real=realpathSync.native(dir);} catch {throw new Error('project-directory-unavailable');}
  if(real!==dir || !lstatSync(dir).isDirectory())throw new Error('project-directory-changed');
  // Compare without case: the host file system can ignore it. The state directory holds the capabilities.
  const inside=(path:string):boolean=>{const p=path.toLowerCase(),d=dir.toLowerCase();return p===d || p.startsWith(d+'/');};
  if(inside(realpathSync.native(stateRoot)))throw new Error('project-directory-contains-state');
  if(inside(config.endpoint.slice('unix://'.length)))throw new Error('project-directory-contains-socket');
}
// A read-only mount does not stop a connection to a socket. A socket in the tree can reach the host or a network.
export function projectTreeValid(dir:string):void {
  let handle;
  try {handle=opendirSync(dir,{recursive:true});} catch {throw new Error('project-directory-unavailable');}
  try {
    let count=0;
    for(;;) {
      let entry;
      try {entry=handle.readSync();} catch {throw new Error('project-directory-unreadable');}
      if(entry===null)break;
      if(++count>PROJECT.entries)throw new Error('project-directory-too-large');
      if(entry.isSocket() || entry.isFIFO() || entry.isBlockDevice() || entry.isCharacterDevice())throw new Error('project-directory-special-file');
    }
  } finally {handle.closeSync();}
}
export function enforceProjectContainer(input:unknown, grant:ProjectGrant, config:Configuration, name:string, runId:string):ProjectInspection {
  const c=Inspection.parse(input), h=c.HostConfig;
  if(h.Runtime!==config.runtime)throw new Error('container-runtime-mismatch');
  const command=[...(c.Config.Entrypoint ?? []),...(c.Config.Cmd ?? [])];
  if(c.Name!==`/${name}` || c.Image!==grant.imageId || c.Config.User!=='1000:1000' || c.Config.WorkingDir!=='/work' || c.Config.Labels[OWNER]!==config.owner || c.Config.Labels[RUN]!==runId || command.join('\0')!==grant.argv.join('\0'))throw new Error('container-identity-mismatch');
  if(h.NetworkMode!=='none' || !h.ReadonlyRootfs || h.Privileged || h.CapDrop.length!==1 || h.CapDrop[0]?.toUpperCase()!=='ALL' || (h.CapAdd?.length ?? 0)>0 || !h.SecurityOpt.includes('no-new-privileges') || h.SecurityOpt.some(x=>x.includes('unconfined')) || h.Memory!==grant.budget.memory || h.MemorySwap!==grant.budget.memory || h.NanoCpus!==Math.round(grant.budget.cpu*1e9) || h.PidsLimit!==grant.budget.pids || (h.Binds?.length ?? 0)>0 || h.RestartPolicy.Name!=='no' || h.LogConfig.Type!=='none' || Object.keys(h.PortBindings ?? {}).length>0)throw new Error('container-controls-mismatch');
  const binds=c.Mounts.filter(m=>m.Type==='bind');
  if(Object.keys(h.Tmpfs).join()!=='/tmp' || h.Tmpfs['/tmp']!==tmpfs(grant) || binds.length!==1 || binds[0]!.Destination!=='/work' || binds[0]!.Source!==grant.projectDir || binds[0]!.RW!==false || c.Mounts.some(m=>m.Type!=='bind' && (m.Type!=='tmpfs' || m.Destination!=='/tmp')))throw new Error('container-storage-mismatch');
  return c;
}

export class ProjectRunner {
  private readonly sessions=new Map<string,ProjectSession>();
  private active:{sessionId:string;run:ProjectRun;abort:AbortController;task:Promise<void>;cancelled:boolean}|undefined;
  private closing=false;
  private constructor(readonly store:Store, readonly config:Configuration, readonly backend:DockerBackend) {}
  static async open(store:Store, config:Configuration, backend:DockerBackend):Promise<ProjectRunner> {
    const runner=new ProjectRunner(store,config,backend);
    for(const name of store.names('project-session-')) {
      const session=Session.parse(store.read(name));
      if(name!==`project-session-${session.id}.json`)throw new Error('state-id-mismatch');
      for(const run of session.runs)if(run.state==='running'){run.state='error';run.reason='server-restart';run.finishedAt=new Date().toISOString();}
      runner.sessions.set(session.id,session);runner.save(session);
    }
    await runner.sweep();
    return runner;
  }
  private save(session:ProjectSession):void {this.store.write(`project-session-${session.id}.json`,session);}
  private name(runId:string):string {return `podori-project-${this.config.owner}-${Id.parse(runId)}`;}
  // Remove every container of this owner. Project containers never outlive a run.
  private async sweep():Promise<void> {
    const out=await this.backend.command(['container','ls','-a','--filter',`label=${OWNER}=${this.config.owner}`,'--format','{{.ID}}']);
    // An image can declare volumes. Remove the anonymous volumes with the container.
    for(const id of out?out.split('\n'):[])await this.backend.command(['container','rm','--force','--volumes',id]);
    if(await this.backend.command(['container','ls','-a','--filter',`label=${OWNER}=${this.config.owner}`,'--format','{{.ID}}'])!=='')throw new Error('cleanup-not-confirmed');
  }
  private access(input:unknown):ProjectSession {
    const access=ProjectAccess.parse(input), session=this.sessions.get(access.projectId);
    if(!session || !matchesToken(access.accessToken,session.tokenHash))throw new Error('access-denied');
    return session;
  }
  private grantValid(session:ProjectSession):void {
    const current=ProjectApproval.parse(this.store.read(`project-grant-${session.grant.id}.json`));
    if(objectHash(current)!==objectHash(session.grant))throw new Error('approval-changed');
    projectScopeValid(session.grant,this.config);
  }
  create(input:unknown):unknown {
    if(this.closing)throw new Error('controller-closed');
    const parsed=CreateInput.parse(input);
    let grant:ProjectGrant;
    try {
      grant=ProjectApproval.parse(this.store.read(`project-grant-${parsed.approvalId}.json`));
      projectScopeValid(grant,this.config);
    } catch(error) {if(error instanceof z.ZodError)throw new Error('invalid-approval');throw new Error('access-denied');}
    if(grant.id!==parsed.approvalId || !matchesToken(parsed.claimToken,grant.claimHash))throw new Error('access-denied');
    if([...this.sessions.values()].some(s=>s.grant.id===grant.id))throw new Error('approval-already-used');
    if(this.sessions.size>=PROJECT.sessions)throw new Error('record-limit');
    const id=randomUUID(), token=randomBytes(32).toString('hex');
    const session:ProjectSession={id,tokenHash:digest(token),grant,createdAt:new Date().toISOString(),runs:[]};
    this.sessions.set(id,session);this.save(session);
    return {projectId:id,accessToken:token,...this.summary(session)};
  }
  private summary(session:ProjectSession):object {
    const g=session.grant;
    return {reportId:g.reportId,itemId:g.itemId,target:g.target,projectDir:g.projectDir,imageId:g.imageId,argv:g.argv,budget:g.budget,runtime:g.runtime,platform:g.platform,expiresAt:g.expiresAt,approvalHash:objectHash(g)};
  }
  run(input:unknown):unknown {
    const session=this.access(input);
    if(this.closing)throw new Error('controller-closed');
    this.grantValid(session);
    if(this.active)throw new Error('concurrency-limit');
    if(session.runs.length>=PROJECT.runs)throw new Error('attempt-limit');
    projectDirValid(session.grant.projectDir,this.config,this.store.root);
    const run:ProjectRun={id:randomUUID(),startedAt:new Date().toISOString(),finishedAt:null,state:'running',reason:null,exitCode:null,oomKilled:null,outputBytes:0,outputHash:null,outputTail:'',outputTruncated:false,controls:null};
    session.runs.push(run);
    try {this.save(session);} catch(error) {session.runs.pop();throw error;}
    const abort=new AbortController();
    const active={sessionId:session.id,run,abort,cancelled:false,task:Promise.resolve()};
    // execute() records every failure in the run. It must never reject: nothing awaits it on the normal path.
    active.task=this.execute(session,run,active).catch(()=>{run.state='error';run.reason='operation-failed';run.finishedAt=new Date().toISOString();}).finally(()=>{if(this.active===active)this.active=undefined;});
    this.active=active;
    return {projectId:session.id,runId:run.id,status:'running'};
  }
  private async execute(session:ProjectSession, run:ProjectRun, active:{abort:AbortController;cancelled:boolean}):Promise<void> {
    const grant=session.grant, name=this.name(run.id);
    // Publish the final state only after cleanup. A reader must not see a finished run with a live container.
    let state:ProjectRun['state']='error', why:string|null=null;
    try {
      await this.sweep();
      const identity=enforceHost(JSON.parse(await this.backend.command(['info','--format','{{json .}}'])),this.config.runtime);
      if(identity.platform!==this.config.platform)throw new Error('host-platform-changed');
      if(identity.runtimeConfigHash!==this.config.runtimeConfigHash)throw new Error('runtime-configuration-changed');
      const image=z.array(z.looseObject({Id:z.string(),Os:z.string(),Architecture:z.string()})).parse(JSON.parse(await this.backend.command(['image','inspect',grant.imageId])))[0];
      if(!image || image.Id!==grant.imageId || image.Os!=='linux' || `linux/${image.Architecture}`!==this.config.platform)throw new Error('image-not-verified');
      const [entrypoint,...rest]=grant.argv;
      await this.backend.command(['container','create','--pull=never','--runtime',this.config.runtime,'--platform',this.config.platform,'--name',name,'--label',`${OWNER}=${this.config.owner}`,'--label',`${RUN}=${run.id}`,'--network','none','--user','1000:1000','--cap-drop','ALL','--security-opt','no-new-privileges','--read-only','--tmpfs',`/tmp:${tmpfs(grant)}`,'--mount',`type=bind,src=${grant.projectDir},dst=/work,readonly`,'--workdir','/work','--memory',String(grant.budget.memory),'--memory-swap',String(grant.budget.memory),'--cpus',String(grant.budget.cpu),'--pids-limit',String(grant.budget.pids),'--ipc','none','--restart','no','--log-driver','none','--no-healthcheck','--env','HOME=/tmp','--entrypoint',entrypoint!,grant.imageId,...rest]);
      const inspect=async():Promise<unknown>=>JSON.parse(await this.backend.command(['container','inspect',name]))[0];
      const created=enforceProjectContainer(await inspect(),grant,this.config,name,run.id);
      run.controls={runtime:created.HostConfig.Runtime,network:created.HostConfig.NetworkMode,readonlyRootfs:created.HostConfig.ReadonlyRootfs,user:created.Config.User,mounts:created.Mounts.map(m=>({type:m.Type,destination:m.Destination,rw:m.RW ?? null}))};
      if(active.abort.signal.aborted)throw new Error('operation-cancelled');
      this.grantValid(session);projectDirValid(grant.projectDir,this.config,this.store.root);projectTreeValid(grant.projectDir);
      const output=await this.backend.stream(['container','start','--attach',name],grant.budget.runSeconds*1000,active.abort.signal);
      run.outputBytes=output.bytes;run.outputHash=output.hash;run.outputTail=output.tail;run.outputTruncated=output.truncated;
      const ended=Inspection.parse(await inspect()).State;
      const finished=!ended.Running && ended.Status==='exited';
      if(finished){run.exitCode=ended.ExitCode;run.oomKilled=ended.OOMKilled;}
      if(active.cancelled){state='cancelled';why='owner-cancellation';}
      else if(output.timedOut){state='timed_out';why='run-timeout';}
      else if(output.truncated)why='output-limit';
      // A container that never started has exit code 0. Require the exited state and the same CLI status.
      else if(!finished)why=ended.Running?'target-still-running':'target-not-started';
      else if(output.exitCode!==ended.ExitCode)why='exit-status-mismatch';
      else state='exited';
    } catch(error) {
      state=active.cancelled?'cancelled':'error';why=active.cancelled?'owner-cancellation':reason(error);
    }
    try {await this.sweep();} catch {state='error';why='cleanup-not-confirmed';}
    run.finishedAt=new Date().toISOString();run.reason=why;run.state=state;
    try {this.save(session);} catch {run.state='error';run.reason='state-not-saved';}
  }
  status(input:unknown):unknown {
    const session=this.access(input);
    const body={projectId:session.id,createdAt:session.createdAt,...this.summary(session),runs:session.runs};
    return {...body,hash:objectHash(body)};
  }
  async cancel(input:unknown):Promise<unknown> {
    const session=this.access(input), active=this.active;
    if(active && active.sessionId===session.id) {active.cancelled=true;active.abort.abort();await active.task;}
    return this.status(input);
  }
  async close():Promise<void> {
    this.closing=true;
    const active=this.active;
    if(active) {active.cancelled=true;active.abort.abort();await active.task;}
    await this.sweep();
  }
}
