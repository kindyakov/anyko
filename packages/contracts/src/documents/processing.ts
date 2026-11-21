export const documentProcessingMessages = {
  OCR_FAILED: 'Не удалось распознать документ.',
  OCR_RETRY_REQUIRED: 'Документ нужно распознать заново',
  OCR_PROCESSOR_OUTDATED: 'Сервис распознавания нужно обновить',
  OCR_TOO_MANY_IMAGES:
    'В документе слишком много изображений. Разделите документ на части.',
  OCR_RESULT_TOO_LARGE:
    'Результат распознавания слишком большой. Разделите документ на части.',
  OCR_UNSUPPORTED_EMBEDDED_IMAGE:
    'В документе есть вложенное изображение неподдерживаемого формата, например WMF. Замените его на PNG или JPEG.',
  OCR_IMAGE_TOO_LARGE:
    'В документе есть изображение с разрешением выше 25 мегапикселей.',
  OCR_NO_READABLE_TEXT: 'В документе не найден читаемый текст.',
  OCR_VISION_NOT_CONFIGURED:
    'Для распознавания изображений требуется действующее подключение vision-модели. Проверьте настройки рабочего пространства.',
  OCR_VISION_RATE_LIMITED:
    'Облачная vision-модель временно ограничила число запросов. Попробуйте ещё раз позже.',
  OCR_TIMEOUT:
    'Сервис не успел распознать документ. Попробуйте ещё раз или разделите файл.',
  OCR_STREAM_IDLE:
    'Модель перестала передавать данные распознавания. Попробуйте распознать документ заново.',
  OCR_PROCESSOR_UNAVAILABLE:
    'Сервис распознавания временно недоступен. Попробуйте ещё раз позже.',
  OCR_INVALID_RESULT:
    'Сервис вернул некорректный результат. Попробуйте распознать документ заново.',
} as const;

type DocumentProcessingError = keyof typeof documentProcessingMessages;

export function documentProcessingMessage(code: string | null | undefined) {
  return code && Object.hasOwn(documentProcessingMessages, code)
    ? documentProcessingMessages[code as DocumentProcessingError]
    : undefined;
}
