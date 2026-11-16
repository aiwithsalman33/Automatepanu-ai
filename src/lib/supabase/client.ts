/**
 * TEMPORARY seam (checkpoint 1d → removed in 1e/1f).
 *
 * The browser no longer talks to Supabase. The few modules that still
 * import this file use it for:
 *   .from() / .rpc()  → the app's own data API (src/lib/data/client.ts)
 *   .channel()        → no-op until realtime moves to SSE (1e)
 *   .storage          → refuses with a clear error until MinIO (1f)
 */
import { createClient as createDataClient } from '@/lib/data/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface NoopChannel {
  on: (
    event: string,
    filter: Record<string, unknown>,
    callback: (payload: any) => void
  ) => NoopChannel;
  subscribe: (cb?: (status: string) => void) => NoopChannel;
  unsubscribe: () => Promise<'ok'>;
}

function noopChannel(): NoopChannel {
  const ch: NoopChannel = {
    on: () => ch,
    subscribe: () => ch,
    unsubscribe: async () => 'ok',
  };
  return ch;
}

const storageUnavailable = {
  message:
    'File uploads are temporarily unavailable (storage is moving to the new backend).',
  code: 'storage_unavailable',
};

type Fn = (...args: any[]) => any;

const storage: { from: Fn } = {
  from: () => ({
    upload: (async () => ({ data: null, error: storageUnavailable })) as Fn,
    remove: (async () => ({ data: null, error: storageUnavailable })) as Fn,
    getPublicUrl: (() => ({ data: { publicUrl: '' } })) as Fn,
  }),
};

export type RealtimeChannel = NoopChannel;

export function createClient() {
  const data = createDataClient();
  return {
    from: data.from,
    rpc: data.rpc,
    channel: noopChannel as (name: string, opts?: unknown) => NoopChannel,
    removeChannel: (async () => 'ok' as const) as (
      ch: NoopChannel
    ) => Promise<'ok'>,
    storage,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
