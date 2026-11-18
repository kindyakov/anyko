import type { Tx } from '../../platform/transactions';

import { attachDocument } from './application/attach-document';
import { bumpRevision } from './application/bump-revision';
import { createWork } from './application/create-work';
import { findWork } from './application/find-work';
import { listEvents } from './application/list-events';
import { listWorks } from './application/list-works';
import { notifyDocumentChanged } from './application/notify-document-changed';
import { readCursor } from './application/read-cursor';
import { readSources } from './application/read-sources';
import { recordEvent } from './application/record-event';

import type { WorkIoPort, WorksModule, WorksPorts, WorkStore } from './index';

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
      create: createWork({
        store,
        newId: deps.newId,
        knownPackage: deps.knownPackage,
      }),
      attachDocument: attachDocument({ store }),
      bumpRevision: bumpRevision({ store }),
      recordEvent: recordEvent({ store }),
    },
    queries: {
      list: listWorks({ store }),
      find: findWork({ store }),
      sources: readSources({ store, io: deps.io }),
      cursor: readCursor({ store }),
      events: listEvents({ store }),
    },
  });
  return {
    ...bind(deps.store),
    in: (tx) => bind(deps.storeFor(tx)),
  };
}
