/**
 * Idle timer that triggers a callback after a specified period of inactivity.
 */
export class IdleTimer {
  private timeout: NodeJS.Timeout | null = null;
  private readonly idleMs: number;
  private readonly onIdle: () => void | Promise<void>;

  constructor(idleMs: number, onIdle: () => void | Promise<void>) {
    this.idleMs = idleMs;
    this.onIdle = onIdle;
  }

  /**
   * Start or reset the idle timer
   */
  reset(): void {
    this.cancel();
    this.timeout = setTimeout(() => {
      this.timeout = null;
      void this.onIdle();
    }, this.idleMs);
  }

  /**
   * Cancel the idle timer
   */
  cancel(): void {
    if (this.timeout !== null) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  /**
   * Check if timer is active
   */
  isActive(): boolean {
    return this.timeout !== null;
  }
}
