import { FileIcon, HoverMist, Skeleton } from '@anyko/ui';

import {
  cardSurface,
  DocumentActions,
  type DocumentCardProps,
  DocumentStatus,
  FailureReason,
  ProcessingStripe,
  SelectionCheckbox,
  UploadedAt,
} from '../document-row';
import { LinkedWorks } from '../linked-works';

/** Файл в виде плитки сетки. */
export function DocumentTile(props: DocumentCardProps) {
  const { workspaceId, document, index, checked, disabled, onCheckedChange } =
    props;
  return (
    <li
      className={`${cardSurface(checked, index)} flex min-h-64 flex-col rounded-2xl p-4`}
    >
      <ProcessingStripe document={document} />
      <HoverMist />
      <div className="flex items-start justify-between gap-3">
        <SelectionCheckbox
          label={`Выбрать ${document.filename}`}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
        />
        <DocumentStatus document={document} />
      </div>
      <FileIcon filename={document.filename} className="mt-4 size-12" />
      <p
        className="mt-4 line-clamp-2 font-medium wrap-anywhere"
        title={document.filename}
      >
        {document.filename}
      </p>
      <UploadedAt document={document} className="mt-2" />
      {!!document.linkedWorks?.length && (
        <div className="mt-3 text-xs">
          <LinkedWorks workspaceId={workspaceId} works={document.linkedWorks} />
        </div>
      )}
      <div className="mt-3 empty:hidden">
        <FailureReason document={document} boxed />
      </div>
      <div aria-hidden className="min-h-4 flex-1" />
      <div className="border-t border-white/[0.06] pt-3">
        <DocumentActions {...props} wide />
      </div>
    </li>
  );
}

/** Заготовки карточек, пока каталог загружается, в выбранном виде. */
export function CatalogSkeleton({
  view,
  className,
}: {
  view: 'list' | 'grid';
  className: string;
}) {
  return (
    <ul className={className} aria-busy aria-label="Файлы загружаются">
      {[0, 1, 2].map((item) => (
        <li
          key={item}
          className={`glass flex gap-4 border border-white/[0.06] ${view === 'grid' ? 'min-h-64 flex-col rounded-2xl p-4' : 'items-center rounded-xl px-4 py-3'}`}
        >
          <Skeleton className="size-10 rounded-xl" />
          <div className="flex-1">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-2 h-3 w-1/4" />
          </div>
          <Skeleton className="h-8 w-24 rounded-lg" />
        </li>
      ))}
    </ul>
  );
}
