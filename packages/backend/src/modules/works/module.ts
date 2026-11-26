import type { Tx } from '../../platform/transactions';

import { activeDocument } from './application/active-document';
import { attachDocuments } from './application/attach-document';
import { createWork } from './application/create-work';
import { findWork } from './application/find-work';
import { listEvents } from './application/list-events';
import { listWorks } from './application/list-works';
import { notifyDocumentChanged } from './application/notify-document-changed';
import { readCursor } from './application/read-cursor';
import { readSources } from './application/read-sources';

import {
  WorkError,
  type WorkIoPort,
  type WorksModule,
  type WorksPorts,
  type WorkStore,
} from './index';

export interface WorksDeps {
  store: WorkStore;
  // Хранилище внутри транзакции действия (infrastructure).
  storeFor: (tx: Tx) => WorkStore;
  io: WorkIoPort;
  newId: () => string;
  knownPackage: (packageVersion: string) => boolean;
}

export function createWorksModule(deps: WorksDeps): WorksModule {
  const bind = (store: WorkStore): WorksPorts => ({
    internal: { ...store, notifyDocumentChanged: notifyDocumentChanged(store) },
    commands: {
      rename: async (scope, { workId, title }) => {
        scope.require('works.edit');
        const normalized = title.trim();
        if (!normalized || normalized.length > 200)
          throw new WorkError('INVALID_WORK_INPUT');
        if (!(await store.rename(scope.workspaceId, workId, normalized)))
          throw new WorkError('NOT_FOUND');
      },
      create: createWork({
        store,
        newId: deps.newId,
        knownPackage: deps.knownPackage,
      }),
      attachDocuments: attachDocuments({ store }),
    },
    queries: {
      list: listWorks({ store }),
      find: findWork({ store }),
      sources: readSources({ store, io: deps.io }),
      activeDocument: activeDocument({ store }),
      cursor: readCursor({ store }),
      events: listEvents({ store }),
    },
  });
  return {
    ...bind(deps.store),
    in: (tx) => bind(deps.storeFor(tx)),
  };
}
