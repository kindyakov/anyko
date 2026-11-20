import { proxyApiRequest } from '@/lib/server/api-proxy';
import { readServerConfig } from '@/lib/server/config';
import { serverLogger } from '@/lib/server/logger';

export const dynamic = 'force-dynamic';
async function relay(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const config = readServerConfig();
  return proxyApiRequest(
    request,
    path,
    config.API_ORIGIN,
    60000,
    fetch,
    config.APP_ORIGIN,
    serverLogger(),
  );
}
export {
  relay as GET,
  relay as HEAD,
  relay as POST,
  relay as PATCH,
  relay as PUT,
  relay as DELETE,
};
