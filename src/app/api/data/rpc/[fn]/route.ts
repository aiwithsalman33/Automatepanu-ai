// POST /api/data/rpc/<fn>: allow-listed RPCs for the browser
// (src/lib/data/registry.ts DATA_RPCS), run as the signed-in user.
import { handleRpcRequest } from '@/lib/data/handler';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ fn: string }> }
) {
  const { fn } = await params;
  return handleRpcRequest(request, fn);
}
