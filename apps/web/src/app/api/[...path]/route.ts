import { proxyApiRequest } from '@/lib/api/proxy';
import { readServerConfig } from '@/lib/server/config';

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
  );
}
export { relay as GET, relay as HEAD, relay as POST, relay as DELETE };
