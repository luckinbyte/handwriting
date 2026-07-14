import type { EventListener } from './types';

type Handler = (e: Event) => void;
// EventListener<never> is the bottom type for listeners: every EventListener<T>
// is assignable to it (parameter contravariance — `never` is assignable to any T).
type ListenerKey = EventListener<never>;

/**
 * A thin typed wrapper over the native EventTarget. Zero-cost, standard and
 * tree-shakeable. `on` returns an unsubscribe function for ergonomic teardown.
 */
export class TypedEmitter<TMap> {
  private readonly target = new EventTarget();
  private readonly wrappers = new Map<ListenerKey, Map<string, Handler>>();

  on<K extends keyof TMap & string>(type: K, listener: EventListener<TMap[K]>): () => void {
    const handler: Handler = (e) => listener((e as CustomEvent).detail);
    let byType = this.wrappers.get(listener);
    if (!byType) {
      byType = new Map();
      this.wrappers.set(listener, byType);
    }
    byType.set(type, handler);
    this.target.addEventListener(type, handler);
    return () => this.off(type, listener);
  }

  once<K extends keyof TMap & string>(type: K, listener: EventListener<TMap[K]>): void {
    const handler: Handler = (e) => listener((e as CustomEvent).detail);
    this.target.addEventListener(type, handler, { once: true });
  }

  off<K extends keyof TMap & string>(type: K, listener: EventListener<TMap[K]>): void {
    const byType = this.wrappers.get(listener);
    const handler = byType?.get(type);
    if (handler && byType) {
      this.target.removeEventListener(type, handler);
      byType.delete(type);
      if (byType.size === 0) this.wrappers.delete(listener);
    }
  }

  protected emit<K extends keyof TMap & string>(type: K, detail: TMap[K]): void {
    this.target.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
