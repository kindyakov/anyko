import {
  defaultWorkPageSize,
  type WorkListStatus,
  workListStatusSchema,
  workPageSizeSchema,
} from '@anyko/contracts/works';

import { routes } from '@/lib/routes';

export type WorkListView = 'tiles' | 'list';
export interface WorkListParams {
  q: string;
  status: WorkListStatus;
  page: number;
  pageSize: number;
  view: WorkListView;
}

export function readWorkListParams(
  params: Pick<URLSearchParams, 'get'>,
): WorkListParams {
  const page = Number(params.get('page'));
  return {
    q: (params.get('q') ?? '').slice(0, 200).trim(),
    status: workListStatusSchema.safeParse(params.get('status')).data ?? 'all',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize:
      workPageSizeSchema.safeParse(Number(params.get('pageSize'))).data ??
      defaultWorkPageSize,
    view: params.get('view') === 'list' ? 'list' : 'tiles',
  };
}

export function workListHref(
  workspaceId: string,
  { q, status, page, pageSize, view }: WorkListParams,
) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status !== 'all') params.set('status', status);
  if (page > 1) params.set('page', String(page));
  if (pageSize !== defaultWorkPageSize)
    params.set('pageSize', String(pageSize));
  if (view === 'list') params.set('view', view);
  const path = routes.works(workspaceId);
  return params.size ? `${path}?${params.toString()}` : path;
}
