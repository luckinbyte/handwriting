import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, presets, resolveConfig } from './presets';

describe('presets / resolveConfig', () => {
  it('DEFAULT_CONFIG uses the auto preset', () => {
    expect(DEFAULT_CONFIG.preset).toBe('auto');
    expect(DEFAULT_CONFIG.overlap).toBe(false);
    expect(DEFAULT_CONFIG.maxConcurrent).toBe(8);
    expect(DEFAULT_CONFIG.respectReducedMotion).toBe(true);
  });

  it('resolveConfig applies a named preset rhythm', () => {
    const cfg = resolveConfig({ preset: 'fluid' });
    expect(cfg.preset).toBe('fluid');
    expect(cfg.overlap).toBe(true);
    // non-rhythm fields keep defaults
    expect(cfg.maxConcurrent).toBe(8);
  });

  it('resolveConfig lets explicit user fields override the preset', () => {
    const cfg = resolveConfig({ preset: 'auto', maxConcurrent: 3 });
    expect(cfg.maxConcurrent).toBe(3);
  });

  it('realistic preset never catches up', () => {
    expect(presets.realistic.catchUpThreshold).toBe(Number.POSITIVE_INFINITY);
  });

  it('custom preset keeps defaults for unspecified rhythm fields', () => {
    const cfg = resolveConfig({ preset: 'custom', interCharDelay: 500 });
    expect(cfg.interCharDelay).toBe(500);
    expect(cfg.overlap).toBe(DEFAULT_CONFIG.overlap);
  });
});
