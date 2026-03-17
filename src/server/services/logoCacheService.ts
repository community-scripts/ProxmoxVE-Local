/**
 * Logo cache service — downloads script logos to public/logos/ so they can be
 * served locally by Next.js instead of fetching from remote CDNs on every request.
 *
 * Logos are stored as `public/logos/{slug}.webp` (keeping original extension when not webp).
 * ScriptCard / ScriptDetailModal can then use `/logos/{slug}.{ext}` as the src.
 */

import { existsSync, mkdirSync } from 'fs';
import { writeFile, readdir, unlink } from 'fs/promises';
import { join, extname } from 'path';

const LOGOS_DIR = join(process.cwd(), 'public', 'logos');

/** Ensure the logos directory exists. */
function ensureLogosDir(): void {
  if (!existsSync(LOGOS_DIR)) {
    mkdirSync(LOGOS_DIR, { recursive: true });
  }
}

/** Extract a reasonable file extension from a logo URL. */
function getExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = extname(pathname).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif', '.ico'].includes(ext)) {
      return ext;
    }
  } catch { /* invalid URL */ }
  return '.webp'; // default
}

export interface LogoEntry {
  slug: string;
  url: string;
}

/**
 * Download logos for the given scripts to `public/logos/`.
 * Skips logos that already exist locally unless `force` is set.
 * Returns the number of newly downloaded logos.
 */
export async function cacheLogos(
  entries: LogoEntry[],
  options?: { force?: boolean; concurrency?: number }
): Promise<{ downloaded: number; skipped: number; errors: number }> {
  ensureLogosDir();

  const force = options?.force ?? false;
  const concurrency = options?.concurrency ?? 10;
  let downloaded = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches of `concurrency`
  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(async (entry) => {
        if (!entry.url) {
          skipped++;
          return;
        }

        const ext = getExtension(entry.url);
        const filename = `${entry.slug}${ext}`;
        const filepath = join(LOGOS_DIR, filename);

        if (!force && existsSync(filepath)) {
          skipped++;
          return;
        }

        const response = await fetch(entry.url, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${entry.url}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        await writeFile(filepath, buffer);
        downloaded++;
      }),
    );

    for (const r of results) {
      if (r.status === 'rejected') {
        errors++;
      }
    }
  }

  return { downloaded, skipped, errors };
}

/**
 * Given a remote logo URL and a slug, return the local path if the logo
 * has been cached, otherwise return the original URL.
 */
export function getLocalLogoPath(slug: string, remoteUrl: string | null): string | null {
  if (!remoteUrl) return null;
  const ext = getExtension(remoteUrl);
  const filename = `${slug}${ext}`;
  const filepath = join(LOGOS_DIR, filename);
  if (existsSync(filepath)) {
    return `/logos/${filename}`;
  }
  return remoteUrl;
}

/**
 * Clean up logos for scripts that no longer exist.
 */
export async function cleanupOrphanedLogos(activeSlugs: Set<string>): Promise<number> {
  ensureLogosDir();
  let removed = 0;
  try {
    const files = await readdir(LOGOS_DIR);
    for (const file of files) {
      const slug = file.replace(/\.[^.]+$/, '');
      if (!activeSlugs.has(slug)) {
        await unlink(join(LOGOS_DIR, file));
        removed++;
      }
    }
  } catch { /* directory may not exist yet */ }
  return removed;
}
