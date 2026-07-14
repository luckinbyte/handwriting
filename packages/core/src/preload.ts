import { CharDataLoader } from './cache/Loader';
import { DEFAULT_CDN_BASE } from './presets';

/**
 * Preload the hanzi-writer module (so the first Han character doesn't stall on
 * a dynamic import) and optionally warm the HTTP cache for specific characters.
 */
export async function preloadHanzi(chars?: string): Promise<void> {
  await import('hanzi-writer');
  if (chars && chars.length > 0) {
    const loader = new CharDataLoader({ cdnBase: DEFAULT_CDN_BASE, memoryCacheSize: 2048 });
    await Promise.all(
      [...chars].map((c) =>
        loader.fetch(c).catch(() => {
          /* ignore — will retry at render time */
        }),
      ),
    );
  }
}
