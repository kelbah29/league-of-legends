/**
 * Sliding-window rate limiter matching a Riot development key's limits
 * (20 requests / 1s, 100 requests / 2min). Callers await `acquire()` before
 * each Riot API request; requests are serialized through this single queue
 * so we never burst past the window even across concurrent callers.
 */
class SlidingWindowRateLimiter {
  private readonly windows: { limit: number; windowMs: number; timestamps: number[] }[];
  private queue: Promise<void> = Promise.resolve();

  constructor(windows: { limit: number; windowMs: number }[]) {
    this.windows = windows.map((w) => ({ ...w, timestamps: [] }));
  }

  async acquire(): Promise<void> {
    const run = this.queue.then(() => this.waitForSlot());
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async waitForSlot(): Promise<void> {
    for (;;) {
      const now = Date.now();
      let waitMs = 0;

      for (const w of this.windows) {
        w.timestamps = w.timestamps.filter((t) => now - t < w.windowMs);
        if (w.timestamps.length >= w.limit) {
          const oldest = w.timestamps[0];
          waitMs = Math.max(waitMs, w.windowMs - (now - oldest) + 10);
        }
      }

      if (waitMs === 0) {
        const stamp = Date.now();
        for (const w of this.windows) w.timestamps.push(stamp);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

export const riotRateLimiter = new SlidingWindowRateLimiter([
  { limit: 20, windowMs: 1_000 },
  { limit: 100, windowMs: 120_000 },
]);
