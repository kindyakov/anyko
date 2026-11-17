// Единица работы (ADR 0009): сценарий открывает транзакцию через UnitOfWork.run и передаёт
// непрозрачный токен Tx в module.in(tx). Драйвер базы данных в типе не виден: токен не даёт
// ни клиента, ни методов, а связь с транзакцией держит runtime.

declare const transactionBrand: unique symbol;

export interface Tx {
  readonly [transactionBrand]: true;
}

// Callback может быть повторён драйвером при конфликте сериализации: внешние вызовы (S3, Redis, OCR,
// LLM) внутри него не выполняются (backend.md, «Транзакции»).
export interface UnitOfWork {
  run<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
}

const handles = new WeakMap<Tx, object>();

// Вызывает только runtime: связывает токен с транзакцией драйвера.
export function openTransaction(handle: object): Tx {
  const tx = {} as Tx;
  handles.set(tx, handle);
  return tx;
}

// Вызывает только infrastructure модуля: получает транзакцию драйвера для своих хранилищ (storeFor).
// Чужой или уже закрытый токен не вернёт транзакции: это ошибка композиции, не ответ клиенту.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- параметр T называет клиент драйвера для storeFor; без него хранилища не получают тип
export function transactionHandle<T extends object>(tx: Tx): T {
  const handle = handles.get(tx);
  if (!handle) throw new Error('TRANSACTION_NOT_OPEN');
  return handle as T;
}
