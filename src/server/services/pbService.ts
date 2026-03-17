/**
 * PocketBase client singleton for server-side use.
 * Mirrors the pattern from ProxmoxVE-Frontend/lib/server-pb.ts.
 * Unauthenticated – only accesses public collections.
 */
import PocketBase from "pocketbase";
import { env } from "~/env.js";

let _cachedPb: PocketBase | null = null;

export function getPb(): PocketBase {
  if (!_cachedPb) {
    _cachedPb = new PocketBase(env.PB_URL);
    // Disable auto-cancellation so concurrent requests don't cancel each other
    _cachedPb.autoCancellation(false);
  }
  return _cachedPb;
}

/** Reset cached client (useful in tests). */
export function _resetCachedPb(): void {
  _cachedPb = null;
}
