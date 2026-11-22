export interface DatabaseEventSignal {
  workspaceId: string;
  workId?: string | undefined;
  documentId?: string | undefined;
  eventKind?: string | undefined;
  kind: 'work' | 'history' | 'recognition' | 'work-list';
}

/** null marks a connected listener and asks consumers to catch up. */
export type SubscribeDatabaseEvents = (
  receive: (signal: DatabaseEventSignal | null | 'unavailable') => void,
) => () => void;
