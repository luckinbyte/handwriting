/**
 * Tracks whether the backlog exceeds the catch-up threshold and fires a
 * callback only on transitions (active → idle, idle → active).
 */
export class CatchUpController {
  private activeFlag = false;
  onChange?: (active: boolean, backlog: number) => void;

  constructor(private readonly getThreshold: () => number) {}

  /** Recompute from the current backlog; returns the active state. */
  refresh(backlog: number): boolean {
    const active = backlog > this.getThreshold();
    if (active !== this.activeFlag) {
      this.activeFlag = active;
      this.onChange?.(active, backlog);
    }
    return active;
  }

  get isActive(): boolean {
    return this.activeFlag;
  }
}
