export { createAccess, provisionLocalAccess } from './infrastructure/auth';
export {
  createWorkspaceActorScope,
  type WorkspaceActorScope,
} from './infrastructure/workspace-actor-scope';
export type { AccessSession } from './domain/scope';
export { scopeFor } from './domain/scope';
