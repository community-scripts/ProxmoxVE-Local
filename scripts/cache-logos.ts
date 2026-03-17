/**
 * Build-time script: fetch all logos from PocketBase and cache them to public/logos/.
 * Called as part of `npm run build` so the app starts with logos pre-cached.
 */

import { getPb } from '../src/server/services/pbService';
import { cacheLogos } from '../src/server/services/logoCacheService';

async function main() {
  console.log('[cache-logos] Fetching script list from PocketBase...');
  const pb = getPb();
  const records = await pb.collection('script_scripts').getFullList({
    fields: 'slug,logo',
    batch: 500,
  });

  const entries = records
    .filter((r) => r.logo)
    .map((r) => ({ slug: r.slug, url: r.logo }));

  console.log(`[cache-logos] Caching ${entries.length} logos...`);
  const result = await cacheLogos(entries);
  console.log(
    `[cache-logos] Done: ${result.downloaded} downloaded, ${result.skipped} already cached, ${result.errors} errors`,
  );
}

main().catch((err) => {
  console.error('[cache-logos] Failed:', err);
  // Non-fatal — build should continue even if logo caching fails
  process.exit(0);
});
