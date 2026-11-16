// /api/tags/[id]
//   PATCH  { name?, color? }   agent+ (RLS)
//   DELETE                     agent+ (RLS); contact links cascade
import { NextResponse } from 'next/server';

import { isSameOrigin } from '@/lib/api/same-origin';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

type Params = { params: Promise<{ id: string }> };

function statusFor(code: string | undefined) {
  return code === '23505' ? 409 : code === '42501' ? 403 : 500;
}

export async function PATCH(request: Request, { params }: Params) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Cross-origin request refused' },
      { status: 403 }
    );
  }
  const { id } = await params;
  if (!UUID_RE.test(id))
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const ctx = await getCurrentAccount();
    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      color?: unknown;
    } | null;
    const patch: Record<string, string> = {};
    if (typeof body?.name === 'string') {
      const name = body.name.trim();
      if (!name || name.length > 50) {
        return NextResponse.json(
          { error: 'Name must be 1–50 characters' },
          { status: 400 }
        );
      }
      patch.name = name;
    }
    if (typeof body?.color === 'string') {
      if (!COLOR_RE.test(body.color)) {
        return NextResponse.json(
          { error: 'Color must be #rrggbb' },
          { status: 400 }
        );
      }
      patch.color = body.color;
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }
    const { data, error } = await ctx.supabase
      .from('tags')
      .update(patch)
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select('*')
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusFor(error.code) }
      );
    }
    if (!data)
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ tag: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Cross-origin request refused' },
      { status: 403 }
    );
  }
  const { id } = await params;
  if (!UUID_RE.test(id))
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const ctx = await getCurrentAccount();
    const { data, error } = await ctx.supabase
      .from('tags')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select('id');
    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusFor(error.code) }
      );
    }
    if (!data?.length)
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
