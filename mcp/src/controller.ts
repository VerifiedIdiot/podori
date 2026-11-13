import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { BUDGET, Access, Approval, Config, CreateInput, Hash, Id, RunInput, Runtime, Platform, Scenario, authorize, digest, matchesToken, objectHash, scopeValid, type Configuration } from './policy.js';
import { DockerBackend, CommandFailure, daemonIsolation } from './docker.js';
import { Store } from './store.js';
import { HttpObservation, INITIAL, evaluate, requests, unverified } from './evidence.js';

const Result = z.enum(['reproduced','not-reproduced','unverified']);
const ResetRow=z.strictObject({before:HttpObservation,reset:HttpObservation,after:HttpObservation});
const ResetObservation=z.strictObject({vulnerable:ResetRow,fixed:ResetRow});
const Attempt = z.strictObject({
  id:Id,experimentId:Id,reportId:z.string(),itemId:z.string(),scenario:Scenario,
  runtime:Runtime,runtimeConfigHash:Hash,platform:Platform,isolation:z.unknown().nullable(),
  fixtureRevision:Hash,imageId:z.string(),approvalHash:Hash,inputHash:Hash,initialHash:Hash,
  startedAt:z.iso.datetime(),finishedAt:z.iso.datetime().nullable(),reason:z.string().nullable(),
  state:z.enum(['running','complete','unverified']),exitStatus:z.number().nullable(),
  observations:z.unknown().nullable(),observationHash:Hash.nullable(),endState:z.unknown().nullable(),resourceUse:z.unknown().nullable(),
  verdict:z.strictObject({original:Result,fixed:Result,normal:z.boolean(),fixVerified:z.boolean()}),
});

const RecordSchema = z.strictObject({
  id:Id, tokenHash:Hash, grant:Approval, generation:z.number().int().nonnegative(),
  status:z.enum(['creating','ready','running','completed','resetting','disposing','disposed','cancelled','timed_out','error','recovered']),
  createdAt:z.iso.datetime(), reason:z.string().max(64).nullable(), isolation:z.unknown().nullable(),
  attempts:z.array(Attempt).max(BUDGET.attempts),
  exclusions:z.array(z.strictObject({reason:z.string(),requestedScenario:z.string(),result:z.literal('unverified')})).max(8),
  resets:z.array(z.strictObject({id:Id,initialHash:Hash,observationHash:Hash,observations:ResetObservation,isolation:z.unknown(),at:z.iso.datetime()})).max(4),
  termination:z.unknown().nullable(),
});
type Experiment = z.infer<typeof RecordSchema>;
export function safeError(error:unknown):string {
  if(error instanceof z.ZodError)return 'invalid-input';
  if(error instanceof CommandFailure)return error.reason;
  const message=error instanceof Error?error.message:'';
  return /^[a-z][a-z0-9-]{1,63}$/.test(message)?message:'operation-failed';
}
export class Controller {
  readonly config:Configuration;
  readonly backend:DockerBackend;
  private readonly records=new Map<string,Experiment>();
  private readonly pending=new Map<string,Promise<void>>();
  private readonly timers=new Map<string,NodeJS.Timeout>();
  private readonly stopping=new Map<string,Promise<void>>();
  private closing=false;
  private closeTask:Promise<void>|undefined;
  private monitor:NodeJS.Timeout|undefined;
  private monitorTask:Promise<void>|undefined;
  private controlsUnknown=false;
  private environmentBusy=false;
  private readonly release:()=>void;
  private constructor(readonly store:Store, backend?:DockerBackend) {
    this.config=Config.parse(store.read('policy.json'));
    this.backend=backend ?? new DockerBackend(this.config,store.root);
    this.release=store.lock();
  }
  static async open(root:string, backend?:DockerBackend):Promise<Controller> {
    const controller=new Controller(new Store(root),backend);
    try {
      for(const name of controller.store.names('experiment-')) {
        const record=RecordSchema.parse(controller.store.read(name));
        if(name!==`experiment-${record.id}.json`)throw new Error('state-id-mismatch');
        controller.records.set(record.id,record);
        if(['disposed','cancelled','timed_out','error','recovered'].includes(record.status))await controller.backend.remove(record.id);
        else await controller.stop(record,'recovered','server-restart');
      }
      if((await controller.backend.owned()).length>0)throw new Error('unrecorded-owned-resource');
      controller.monitor=setInterval(()=>{
        if(controller.monitorTask || controller.closing)return;
        const task=controller.reconcile();controller.monitorTask=task;
        void task.then(()=>{controller.controlsUnknown=false;},()=>{controller.controlsUnknown=true;}).finally(()=>{controller.monitorTask=undefined;});
      },500);
      return controller;
    } catch(error) {controller.release();throw error;}
  }
  private save(record:Experiment):void {this.store.write(`experiment-${record.id}.json`,record);}
  private async reconcile():Promise<void> {
    const owned=await this.backend.owned();
    const known=new Set([...this.records.values()].map(r=>this.backend.name(r.id)));
    if(owned.some(name=>!known.has(name)))throw new Error('unrecorded-owned-resource');
    for(const record of this.records.values()) {
      if(this.closing)return;
      if(this.pending.has(record.id) || this.stopping.has(record.id))continue;
      if(['ready','completed'].includes(record.status)) {
        const actual=await this.backend.inspect(record.id);
        if(this.pending.has(record.id) || this.stopping.has(record.id))continue;
        if(!actual?.State.Running)await this.stop(record,'error','target-exited');
      } else if(owned.includes(this.backend.name(record.id))) {
        await this.backend.remove(record.id);
      }
    }
  }
  private access(input:unknown):Experiment {
    const access=Access.parse(input), record=this.records.get(access.experimentId);
    if(!record || !matchesToken(access.accessToken,record.tokenHash))throw new Error('access-denied');
    return record;
  }
  async environment():Promise<unknown> {
    if(this.controlsUnknown || [...this.records.values()].some(r=>r.reason==='cleanup-not-confirmed' || r.status==='disposing'))throw new Error('controls-unverified');
    if(this.environmentBusy)throw new Error('control-concurrency-limit');
    this.environmentBusy=true;
    try {
      const host=await this.backend.preflight();
      return {configured:true,available:true,target:'synthetic-http-v1',runtime:this.config.runtime,runtimeConfigHash:this.config.runtimeConfigHash,platform:this.config.platform,fixtureRevision:this.config.fixtureRevision,imageId:this.config.imageId,budget:BUDGET,daemonIsolation:daemonIsolation(host)};
    } finally {this.environmentBusy=false;}
  }
  create(input:unknown):unknown {
    if(this.closing)throw new Error('controller-closed');
    if(this.controlsUnknown || [...this.records.values()].some(r=>r.reason==='cleanup-not-confirmed' || r.status==='disposing'))throw new Error('controls-unverified');
    const parsed=CreateInput.parse(input);
    let grant;
    try {grant=authorize(this.store.read(`grant-${parsed.approvalId}.json`),this.config,parsed.claimToken);}
    catch(error) {if(error instanceof z.ZodError)throw new Error('invalid-approval');throw new Error('access-denied');}
    if(grant.id!==parsed.approvalId)throw new Error('access-denied');
    if([...this.records.values()].some(r=>r.grant.id===grant.id))throw new Error('approval-already-used');
    if(this.records.size>=BUDGET.records)throw new Error('record-limit');
    if([...this.records.values()].filter(r=>['creating','ready','running','completed','resetting','disposing'].includes(r.status)).length>=BUDGET.concurrency)throw new Error('concurrency-limit');
    const id=randomUUID(), token=randomBytes(32).toString('hex');
    const record:Experiment={id,tokenHash:digest(token),grant,generation:0,status:'creating',createdAt:new Date().toISOString(),reason:null,isolation:null,attempts:[],exclusions:[],resets:[],termination:null};
    this.records.set(id,record); this.save(record);
    const generation=record.generation;
    const checkpoint=():void=>{if(record.generation!==generation || this.closing)throw new Error('operation-cancelled');this.grantValid(record);};
    const task=(async()=>{
      try {
        const actual=await this.backend.provision(id,checkpoint); checkpoint();
        const states=z.strictObject({vulnerable:HttpObservation,fixed:HttpObservation}).parse(actual.states);
        if([states.vulnerable,states.fixed].some(s=>s.response.status!==200 || objectHash(s.response.body)!==objectHash(INITIAL)))throw new Error('initial-state-mismatch');
        const host={OSType:'linux',runtime:this.config.runtime,runtimeConfigHash:this.config.runtimeConfigHash,platform:this.config.platform};
        record.isolation={host,inspection:actual.inspection,probe:actual.probe,hostControls:actual.hostControls,states};
        record.status='ready';this.save(record);
      } catch(error) {
        if(record.generation!==generation)return;
        record.status='error';record.reason=safeError(error);
        try {await this.backend.remove(id);} catch {record.reason='cleanup-not-confirmed';}
        this.save(record);
      }
    })().finally(()=>this.pending.delete(id));
    this.pending.set(id,task);
    this.timers.set(id,setTimeout(()=>{void this.stop(record,'timed_out','lifetime-limit').catch(()=>{});},BUDGET.lifetimeSeconds*1000));
    return {experimentId:id,accessToken:token,status:record.status};
  }
  status(input:unknown):unknown {
    const record=this.access(input);
    return {experimentId:record.id,status:record.status,reason:record.reason,reportId:record.grant.reportId,itemId:record.grant.itemId,scenario:record.grant.scenario,runtime:record.grant.runtime,runtimeConfigHash:record.grant.runtimeConfigHash,platform:record.grant.platform,fixtureRevision:record.grant.fixtureRevision,imageId:record.grant.imageId,createdAt:record.createdAt};
  }
  evidence(input:unknown):unknown {
    const record=this.access(input);
    const body={...this.status(input) as object,approvalHash:objectHash(record.grant),initialHash:objectHash(INITIAL),isolation:record.isolation,attempts:record.attempts,exclusions:record.exclusions,resets:record.resets,termination:record.termination};
    return {...body,hash:objectHash(body)};
  }
  private grantValid(record:Experiment):void {
    if(this.controlsUnknown || record.reason==='cleanup-not-confirmed')throw new Error('controls-unverified');
    const current=Approval.parse(this.store.read(`grant-${record.grant.id}.json`));
    if(objectHash(current)!==objectHash(record.grant))throw new Error('approval-changed');
    scopeValid(record.grant,this.config);
  }
  run(input:unknown):unknown {
    const parsed=RunInput.parse(input),record=this.access({experimentId:parsed.experimentId,accessToken:parsed.accessToken});
    if(this.closing)throw new Error('controller-closed');
    if(!Scenario.safeParse(parsed.scenario).success || parsed.scenario!==record.grant.scenario) {
      if(record.exclusions.length<8)record.exclusions.push({reason:'scenario-not-approved',requestedScenario:Scenario.safeParse(parsed.scenario).success?parsed.scenario:'unregistered',result:'unverified'});
      this.save(record);throw new Error('scenario-not-approved');
    }
    this.grantValid(record);
    if(!['ready','completed'].includes(record.status))throw new Error('experiment-not-ready');
    if(record.attempts.length>=BUDGET.attempts)throw new Error('attempt-limit');
    const scenario=Scenario.parse(parsed.scenario),generation=record.generation;
    const attempt:z.infer<typeof Attempt>={id:randomUUID(),experimentId:record.id,reportId:record.grant.reportId,itemId:record.grant.itemId,scenario,runtime:record.grant.runtime,runtimeConfigHash:record.grant.runtimeConfigHash,platform:record.grant.platform,isolation:null,fixtureRevision:record.grant.fixtureRevision,imageId:record.grant.imageId,approvalHash:objectHash(record.grant),inputHash:objectHash(requests(scenario)),initialHash:objectHash(INITIAL),startedAt:new Date().toISOString(),finishedAt:null,reason:null,state:'running',exitStatus:null,observations:null,observationHash:null,endState:null,resourceUse:null,verdict:unverified()};
    record.attempts.push(attempt);record.status='running';record.reason=null;this.save(record);
    const checkpoint=():void=>{if(record.generation!==generation || this.closing)throw new Error('operation-cancelled');this.grantValid(record);};
    const timeout=setTimeout(()=>{void this.stop(record,'timed_out','run-timeout').catch(()=>{});},BUDGET.runMs);
    const task=(async()=>{
      try {
        await this.backend.preflight();checkpoint();
        attempt.isolation=await this.backend.verifyIsolation(record.id,checkpoint);checkpoint();
        const observations=await this.backend.observe(record.id,scenario);checkpoint();
        const endState=await this.backend.inspect(record.id);checkpoint();
        if(!endState?.State.Running)throw new Error('target-exited');
        const resourceUse:unknown=JSON.parse(await this.backend.command(['stats','--no-stream','--format','{{json .}}',this.backend.name(record.id)]));checkpoint();
        attempt.observations=observations;attempt.observationHash=objectHash(observations);attempt.verdict=evaluate(scenario,observations);
        attempt.exitStatus=0;attempt.endState=endState.State;attempt.resourceUse=resourceUse;attempt.state='complete';attempt.finishedAt=new Date().toISOString();
        record.status='completed';this.save(record);
      } catch(error) {
        if(record.generation!==generation)return;
        attempt.state='unverified';attempt.reason=safeError(error);attempt.finishedAt=new Date().toISOString();
        record.status='error';record.reason=attempt.reason;
        try {attempt.endState=(await this.backend.inspect(record.id))?.State ?? null;await this.backend.remove(record.id);} catch {record.reason='cleanup-not-confirmed';}
        this.save(record);
      }
    })().finally(()=>{clearTimeout(timeout);this.pending.delete(record.id);});
    this.pending.set(record.id,task);
    return {experimentId:record.id,attemptId:attempt.id,result:'unverified',status:'running'};
  }
  async reset(input:unknown):Promise<unknown> {
    const record=this.access(input);this.grantValid(record);
    if(this.closing || !['ready','completed'].includes(record.status))throw new Error('experiment-not-ready');
    if(record.resets.length>=4)throw new Error('reset-limit');
    const generation=record.generation;
    record.status='resetting';this.save(record);
    let failure:unknown;
    const checkpoint=():void=>{if(record.generation!==generation || this.closing)throw new Error('operation-cancelled');this.grantValid(record);};
    const timeout=setTimeout(()=>{void this.stop(record,'timed_out','reset-timeout').catch(()=>{});},BUDGET.runMs);
    const task=(async()=>{
      try {
        await this.backend.preflight();checkpoint();
        const isolation=await this.backend.verifyIsolation(record.id,checkpoint);checkpoint();
        const observations=ResetObservation.parse(await this.backend.observe(record.id,'reset'));checkpoint();
        for(const row of Object.values(observations))if(row.before.response.status!==200 || row.reset.response.status!==200 || row.after.response.status!==200 || objectHash(row.reset.response.body)!==objectHash(INITIAL) || objectHash(row.after.response.body)!==objectHash(INITIAL))throw new Error('reset-not-confirmed');
        record.resets.push({id:randomUUID(),initialHash:objectHash(INITIAL),observationHash:objectHash(observations),observations,isolation,at:new Date().toISOString()});
        record.status='ready';this.save(record);
      } catch(error) {
        failure=error;
        if(record.generation===generation) {
          record.status='error';record.reason=safeError(error);
          try {await this.backend.remove(record.id);}catch {record.reason='cleanup-not-confirmed';}
          this.save(record);
        }
      }
    })().finally(()=>{clearTimeout(timeout);this.pending.delete(record.id);});
    this.pending.set(record.id,task);await task;
    if(failure)throw failure;
    return {experimentId:record.id,restored:true,initialHash:objectHash(INITIAL)};
  }
  private async stop(record:Experiment,status:'disposed'|'cancelled'|'timed_out'|'recovered'|'error',reason:string):Promise<void> {
    const previous=this.stopping.get(record.id);
    if(previous)return await previous;
    const task=this.finishStop(record,status,reason);
    this.stopping.set(record.id,task);
    try {await task;} finally {this.stopping.delete(record.id);}
  }
  private async finishStop(record:Experiment,status:'disposed'|'cancelled'|'timed_out'|'recovered'|'error',reason:string):Promise<void> {
    record.generation++;record.status='disposing';record.reason=reason;
    for(const attempt of record.attempts)if(attempt.state==='running'){attempt.state='unverified';attempt.reason=reason;attempt.finishedAt=new Date().toISOString();}
    this.save(record);
    clearTimeout(this.timers.get(record.id));this.timers.delete(record.id);
    let before:unknown=null;
    try {before=(await this.backend.inspect(record.id))?.State ?? null;} catch { /* Keep unavailable exit evidence null. */ }
    try {await this.backend.remove(record.id);} catch { /* Reconcile once the in-flight operation settles. */ }
    await this.pending.get(record.id);
    try {await this.backend.remove(record.id);record.status=status;record.reason=reason;record.termination={reason,before,confirmedAbsent:true,at:new Date().toISOString()};}
    catch(error) {record.status='error';record.reason='cleanup-not-confirmed';this.save(record);throw error;}
    this.save(record);
  }
  async dispose(input:unknown):Promise<unknown> {
    const record=this.access(input);
    await this.stop(record,'disposed','owner-disposal');
    return this.status(input);
  }
  async cancel(input:unknown):Promise<unknown> {
    const record=this.access(input);
    await this.stop(record,'cancelled','owner-cancellation');
    return this.status(input);
  }
  close():Promise<void> {
    if(this.closeTask)return this.closeTask;
    this.closing=true;
    clearInterval(this.monitor);
    for(const timer of this.timers.values())clearTimeout(timer);
    this.timers.clear();
    this.closeTask=(async()=>{
      try {
        await this.monitorTask?.catch(()=>{});
        const results=await Promise.allSettled([...this.records.values()].map(record=>!this.pending.has(record.id) && !this.stopping.has(record.id) && ['disposed','cancelled','timed_out','error','recovered'].includes(record.status)?this.backend.remove(record.id):this.stop(record,'disposed','controller-shutdown')));
        const failures=results.filter(result=>result.status==='rejected').map(result=>result.reason);
        if(failures.length>0)throw new AggregateError(failures,'controller-shutdown-failed');
      }
      finally {this.release();}
    })();
    return this.closeTask;
  }
}
