// ============================================================
// /api/tags — the account's contact tags.
//
//   GET   list (ordered by name)               any member
//   POST  { name, color } → create             agent+ (RLS tags_insert)
//
// Runs as the caller under RLS; account_id / user_id come from the
// session, never the body. Tag names are not unique in the schema (the
// contact importer merges duplicates), so a repeated name is accepted,
// as it always was; a future unique index would surface here as 409.
// ============================================================
import { NextResponse } from 'next/server';

import { isSameOrigin } from '@/lib/api/same-origin';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';

export const dynamic = 'force-dynamic';

const MAX_NAME = 50;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    const { data, error } = await ctx.supabase
      .from('tags')
      .select('*')
      .eq('account_id', ctx.accountId)
      .order('name');
    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 500 }
      );
    }
    return NextResponse.json({ tags: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Cross-origin request refused' },
      { status: 403 }
    );
  }
  try {
    const ctx = await getCurrentAccount();
    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      color?: unknown;
    } | null;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const color = typeof body?.color === 'string' ? body.color : '';
    if (!name || name.length > MAX_NAME) {
      return NextResponse.json(
        { error: `Name must be 1–${MAX_NAME} characters` },
        { status: 400 }
      );
    }
    if (!COLOR_RE.test(color)) {
      return NextResponse.json(
        { error: 'Color must be #rrggbb' },
        { status: 400 }
      );
    }
    const { data, error } = await ctx.supabase
      .from('tags')
      .insert({ name, color, account_id: ctx.accountId, user_id: ctx.userId })
      .select('*')
      .single();
    if (error) {
      const status =
        error.code === '23505' ? 409 : error.code === '42501' ? 403 : 500;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status }
      );
    }
    return NextResponse.json({ tag: data }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
