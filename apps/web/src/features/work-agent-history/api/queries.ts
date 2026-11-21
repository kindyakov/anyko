import { queryOptions } from '@tanstack/react-query';

import {
  getWorkAgentHistory,
  listWorkAnalysisRuns,
} from '@anyko/contracts/works';

import { callApi } from '@/lib/api/call';

export const agentHistoryRunKey = (
  workspaceId: string,
  workId: string,
  runId: string,
) => ['work-agent-history', workspaceId, workId, runId] as const;

export function analysisRunsQuery(
  workspaceId: string,
  workId: string,
  page: number,
  active: boolean,
  latestRunId: string | null,
) {
  return queryOptions({
    queryKey: [
      'work-analysis-runs',
      workspaceId,
      workId,
      page,
      active,
      latestRunId,
    ] as const,
    queryFn: ({ signal }) =>
      callApi(listWorkAnalysisRuns, {
        params: { workspaceId, workId },
        query: { page },
        signal,
      }),
    gcTime: 0,
  });
}
export function agentHistoryQuery(
  workspaceId: string,
  workId: string,
  runId: string,
  page: number,
  active: boolean,
) {
  return queryOptions({
    queryKey: [...agentHistoryRunKey(workspaceId, workId, runId), page, active],
    queryFn: ({ signal }) =>
      callApi(getWorkAgentHistory, {
        params: { workspaceId, workId, runId },
        query: { page },
        signal,
      }),
    gcTime: 0,
  });
}
