import { analyzeWork } from './analyze-work';
import { attachDocuments } from './attach-documents';
import { createWork } from './create-work';
import type { WorkIntakeDeps } from './deps';
import { removeDocument } from './remove-document';
import { updateRecognition } from './update-recognition';
import { uploadDocument } from './upload-document';

// Процесс «приём работы»: создание, загрузка и удаление исходников, запуск анализа.
export function createWorkIntake(deps: WorkIntakeDeps) {
  return {
    createWork: createWork(deps),
    uploadDocument: uploadDocument(deps),
    attachDocuments: attachDocuments(deps),
    removeDocument: removeDocument(deps),
    updateRecognition: updateRecognition(deps),
    analyzeWork: analyzeWork(deps),
  };
}
export type WorkIntake = ReturnType<typeof createWorkIntake>;
