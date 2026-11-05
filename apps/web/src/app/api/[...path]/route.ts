import { proxyApiRequest } from '../../../lib/api/proxy';
import { readServerConfig } from '../../../lib/server/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyApiRequest(request, path, readServerConfig().API_ORIGIN);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE, handle as HEAD, handle as OPTIONS };
