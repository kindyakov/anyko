import type { AgentsModule } from '../../modules/agents';
import type { ConnectionsModule } from '../../modules/connections';
import type { DocumentsModule, ResourceLocks } from '../../modules/documents';
import type { FactsModule } from '../../modules/facts';
import type { ProcessingModule } from '../../modules/processing';
import type { WorksModule, WorkSourceAttachment } from '../../modules/works';
import type { Tx, UnitOfWork } from '../../platform/transactions';
import type { ResolveWorkPackage } from '../work-package';

export interface WorkIntakeDeps {
  resolvePackage: ResolveWorkPackage;
  uow: UnitOfWork;
  works: WorksModule;
  processing: ProcessingModule;
  connections: ConnectionsModule;
  agents: AgentsModule;
  documents: DocumentsModule;
  facts: FactsModule;
  locks: ResourceLocks;
  lockDocumentRevisions(
    tx: Tx,
    workspaceId: string,
    ids: string[],
    firstReady?: boolean,
  ): Promise<WorkSourceAttachment[]>;
  redactWorkUploadResponses(
    tx: Tx,
    workspaceId: string,
    documentIds: string[],
  ): Promise<void>;
}
