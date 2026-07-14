import type { HandwritingEngine, HandwritingEventMap } from '@handwriting/core';

/**
 * Engine event → DOM event name. Prefixed `hw-` so generic names like `error` /
 * `complete` don't collide with native or consumer events.
 */
export const EVENT_NAMES = {
  charrendered: 'hw-charrendered',
  graphemequeued: 'hw-graphemequeued',
  catchupchange: 'hw-catchupchange',
  configchange: 'hw-configchange',
  error: 'hw-error',
  complete: 'hw-complete',
  destroy: 'hw-destroy',
} as const satisfies Record<keyof HandwritingEventMap, string>;

const KEYS = Object.keys(EVENT_NAMES) as (keyof HandwritingEventMap)[];

/**
 * Re-emit every engine event on `target` as a bubbling `CustomEvent`, carrying
 * the engine's `detail` verbatim. Returns an unsubscribe that undoes all relays.
 */
export function relayEvents(engine: HandwritingEngine, target: EventTarget): () => void {
  const offs = KEYS.map((key) =>
    engine.on(key, (detail) => {
      target.dispatchEvent(new CustomEvent(EVENT_NAMES[key], { detail, bubbles: true }));
    }),
  );
  return () => {
    for (const off of offs) off();
  };
}
