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

/**
 * Retry wrapper for PocketBase queries.
 * Retries on 503 (Service Unavailable) with exponential backoff to handle
 * transient failures when multiple tRPC requests hit PB concurrently.
 */
export async function withPbRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const status =
        typeof error === "object" && error !== null && "status" in error
          ? (error as { status: number }).status
          : 0;
      if ((status === 503 || status === 429) && attempt < maxRetries) {
        const delay = Math.min(500 * 2 ** attempt, 4000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("withPbRetry: unreachable");
}
