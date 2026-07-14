import type { CharacterJson } from '../types';

/**
 * L1 in-memory LRU cache for character stroke data.
 *
 * Hits are synchronous (zero-latency) which lets hanzi-writer render a cached
 * character without any async hop. Map insertion order encodes recency.
 */
export class CharDataCache {
  private map = new Map<string, CharacterJson>();

  constructor(private capacity: number) {}

  get(char: string): CharacterJson | undefined {
    const v = this.map.get(char);
    if (v !== undefined) {
      // Refresh recency: delete + re-insert moves the entry to the end.
      this.map.delete(char);
      this.map.set(char, v);
    }
    return v;
  }

  set(char: string, data: CharacterJson): void {
    if (this.map.has(char)) this.map.delete(char);
    this.map.set(char, data);
    while (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  has(char: string): boolean {
    return this.map.has(char);
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}
