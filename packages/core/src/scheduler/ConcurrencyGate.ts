/** A tiny counting semaphore bounding how many tasks run at once. */
export class ConcurrencyGate {
  private active = 0;
  private max: number;

  constructor(max: number) {
    this.max = max;
  }

  setMax(max: number): void {
    this.max = max;
  }

  /** Acquire unconditionally — caller must have checked `isFull`. */
  acquire(): void {
    if (this.active < this.max) this.active++;
  }

  /** Try to acquire; returns false if the gate is full. */
  tryAcquire(): boolean {
    if (this.active >= this.max) return false;
    this.active++;
    return true;
  }

  release(): void {
    if (this.active > 0) this.active--;
  }

  get count(): number {
    return this.active;
  }

  get isFull(): boolean {
    return this.active >= this.max;
  }
}
