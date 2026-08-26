import { supabase } from '@/lib/supabase';
import { track } from '@/lib/analytics/track';

/** Wraps supabase.rpc with reliability telemetry (name, ok/fail, latency) — a drop-in replacement so call sites don't change shape. */
export async function callRpc<T = unknown>(
  name: string,
  params: Record<string, unknown>
): Promise<{ data: T | null; error: { message: string } | null }> {
  const startedAt = performance.now();
  const { data, error } = await supabase.rpc(name, params);

  track('rpc_call', {
    rpc_name: name,
    ok: !error,
    duration_ms: Math.round(performance.now() - startedAt),
    error_message: error?.message ?? null,
  });

  if (error) {
    return { data: null, error: { message: error.message } };
  }
  return { data: (data as T) ?? null, error: null };
}
