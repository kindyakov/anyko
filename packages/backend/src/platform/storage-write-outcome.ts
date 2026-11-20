export class StorageWriteOutcomeUnknown extends Error {
  constructor(readonly retryable = false) {
    super('STORAGE_WRITE_OUTCOME_UNKNOWN');
  }
}
