import { proxyApiRequest } from '../../../lib/api/proxy';
import { readServerConfig } from '../../../lib/server/config';

export const dynamic = 'force-dynamic';
async function relay(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyApiRequest(request, path, readServerConfig().API_ORIGIN);
}
export { relay as GET, relay as HEAD, relay as POST, relay as DELETE };
