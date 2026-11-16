// POST /api/data/<table>: the browser's data access (checkpoint 1d).
// Validated against src/lib/data/registry.ts, executed as the signed-in
// user under RLS. See src/lib/data/handler.ts.
import { handleDataRequest } from '@/lib/data/handler';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ table: string }> }
) {
  const { table } = await params;
  return handleDataRequest(request, table);
}
