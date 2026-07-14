import { afterEach, describe, expect, it } from 'vitest';
import { StrictMode } from 'react';
import type { RefObject } from 'react';
import { renderHook } from '@testing-library/react';
import { useHandwritingEngine } from './useHandwritingEngine';

function makeRef(): { ref: RefObject<HTMLElement | null>; container: HTMLElement } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const ref = { current: container } as RefObject<HTMLElement | null>;
  return { ref, container };
}

describe('useHandwritingEngine', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('creates the engine after mount and destroys on unmount', () => {
    const { ref, container } = makeRef();
    const { result, unmount } = renderHook(() => useHandwritingEngine(ref, {}));

    expect(result.current).not.toBeNull();
    expect(container.querySelector('.hw-root')).toBeTruthy();

    unmount();
    expect(container.querySelector('.hw-root')).toBeNull();
  });

  it('applies hot-swappable config changes without recreating the engine', () => {
    const { ref } = makeRef();
    const { result, rerender } = renderHook(
      ({ cfg }) => useHandwritingEngine(ref, cfg),
      { initialProps: { cfg: { strokeColor: 'red' } } },
    );

    const first = result.current;
    expect(first?.getConfig().strokeColor).toBe('red');

    rerender({ cfg: { strokeColor: 'blue' } });
    expect(result.current).toBe(first); // same instance — no recreate
    expect(result.current?.getConfig().strokeColor).toBe('blue');
  });

  it('ignores construct-time config changes (engine identity preserved)', () => {
    const { ref } = makeRef();
    const { result, rerender } = renderHook(({ cfg }) => useHandwritingEngine(ref, cfg), {
      initialProps: { cfg: { strokeColor: 'black' } },
    });

    const first = result.current;
    expect(first?.getConfig().virtualization.enabled).toBe(true);

    rerender({ cfg: { strokeColor: 'black', virtualization: { enabled: false, rootMargin: '0px' } } });
    expect(result.current).toBe(first); // unchanged identity
    expect(result.current?.getConfig().virtualization.enabled).toBe(true); // ignored
  });

  it('survives StrictMode dev double-invoke with exactly one sandbox', () => {
    const { ref, container } = makeRef();
    const { unmount } = renderHook(() => useHandwritingEngine(ref), {
      wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    });

    expect(container.querySelectorAll('.hw-root')).toHaveLength(1);
    unmount();
  });
});
