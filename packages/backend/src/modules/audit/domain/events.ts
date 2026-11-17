// Журнал действий (ADR 0009, data-and-jobs.md). Событие пишется в той же транзакции, что и действие.
// Перечень действий и их данных закрыт: ключи API, содержимое документов и значения полей в
// журнал не попадают, потому что произвольного объекта данных здесь нет.

interface AuditTarget {
  readonly kind: 'user' | 'workspace' | 'document' | 'generation';
  readonly id: string;
}

// Общая часть события: область, инициатор (null — операторская команда без пользователя), корреляция.
interface AuditContext {
  readonly workspaceId: string;
  readonly actorId: string | null;
  readonly correlationId?: string | undefined;
}

type AuditEvent =
  | {
      readonly action: 'access.membership_granted';
      readonly target: AuditTarget;
      readonly data: { readonly role: string };
    }
  | {
      readonly action: 'connections.settings_saved';
      readonly target: AuditTarget;
      readonly data: { readonly revision: number };
    }
  | {
      readonly action: 'documents.deleted';
      readonly target: AuditTarget;
      readonly data?: undefined;
    }
  | {
      readonly action: 'generation.started';
      readonly target: AuditTarget;
      readonly data: { readonly workId: string };
    };

export type AuditRecord = AuditEvent & AuditContext;
