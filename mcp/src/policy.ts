import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const BASE_IMAGE = 'docker.io/library/node@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5';
export const BASE_PLATFORM_MANIFEST = 'sha256:156e9bc7a0a267cc6ca77b4283e32b123479342df684ce297455d7b95ff5a6b5';
export const BUDGET = Object.freeze({ cpu: 0.5, memory: 134217728, pids: 64, tmpfs: 4194304, lifetimeSeconds: 45, runMs: 8000, commandMs: 10000, outputBytes: 32768, concurrency: 2, attempts: 4, records: 20 });
export const Budget = z.strictObject({
  cpu: z.literal(BUDGET.cpu), memory: z.literal(BUDGET.memory), pids: z.literal(BUDGET.pids),
  tmpfs: z.literal(BUDGET.tmpfs), lifetimeSeconds: z.literal(BUDGET.lifetimeSeconds),
  runMs: z.literal(BUDGET.runMs), commandMs: z.literal(BUDGET.commandMs),
  outputBytes: z.literal(BUDGET.outputBytes), concurrency: z.literal(BUDGET.concurrency),
  attempts: z.literal(BUDGET.attempts), records: z.literal(BUDGET.records),
});
export const Id = z.uuid();
export const Token = z.string().regex(/^[a-f0-9]{64}$/);
export const Hash = z.string().regex(/^[a-f0-9]{64}$/);
export const ImageId = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const Reference = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/);
export const Scenario = z.enum(['authorization', 'input-validation']);
export type ScenarioId = z.infer<typeof Scenario>;
export const Runtime = z.enum(['runc', 'runsc', 'kata']);
export type RuntimeName = z.infer<typeof Runtime>;
export const Platform = z.enum(['linux/arm64', 'linux/amd64']);
export type NativePlatform = z.infer<typeof Platform>;
const ExecutionIdentity = { runtime: Runtime, runtimeConfigHash: Hash, platform: Platform };
export const Config = z.strictObject({
  version: z.literal(2), owner: Id, ...ExecutionIdentity,
  endpoint: z.string().regex(/^unix:\/\/\/[A-Za-z0-9_./-]+\.sock$/).refine(x => !x.split('/').includes('..')),
  imageId: ImageId, fixtureRevision: Hash, budget: Budget,
});
export type Configuration = z.infer<typeof Config>;
export const Approval = z.strictObject({
  version: z.literal(2), ...ExecutionIdentity,
  id: Id, reportId: Reference, itemId: Reference, target: z.literal('synthetic-http-v1'),
  scenario: Scenario, fixtureRevision: Hash, imageId: ImageId, budget: Budget,
  expiresAt: z.iso.datetime(), claimHash: Hash,
});
export type Grant = z.infer<typeof Approval>;
export const Access = z.strictObject({ experimentId: Id, accessToken: Token });
export type AccessInput = z.infer<typeof Access>;
export const CreateInput = z.strictObject({ approvalId: Id, claimToken: Token });
export const RunInput = Access.extend({ scenario: z.string().min(1).max(64) });

export function digest(text: string | Buffer): string {
  return createHash('sha256').update(text).digest('hex');
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
export function objectHash(value: unknown): string { return digest(canonical(value)); }
export function matchesToken(token: string, expected: string): boolean {
  return Token.safeParse(token).success && Hash.safeParse(expected).success && timingSafeEqual(Buffer.from(digest(token), 'hex'), Buffer.from(expected, 'hex'));
}
export function scopeValid(grant: Grant, config: Configuration): void {
  Approval.parse(grant);
  if (grant.imageId !== config.imageId || grant.fixtureRevision !== config.fixtureRevision || grant.runtime !== config.runtime || grant.runtimeConfigHash !== config.runtimeConfigHash || grant.platform !== config.platform) throw new Error('scope-mismatch');
  if (Date.parse(grant.expiresAt) <= Date.now()) throw new Error('approval-expired');
}
export function authorize(input: unknown, config: Configuration, token: string): Grant {
  const grant = Approval.parse(input);
  scopeValid(grant, Config.parse(config));
  if (!matchesToken(token, grant.claimHash)) throw new Error('access-denied');
  return grant;
}
