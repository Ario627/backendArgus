interface Bucket {
  tokens: number;
  updatedAtMs: number;
}

export class TelemetryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly maxKeys = 4096,
  ) {}

  tryConsume(key: string, nowMs: number = Date.now()): boolean {
    const bucket = this.buckets.get(key);
    if (bucket === undefined) {
      this.evictOldestIfFull();
      this.buckets.set(key, { tokens: this.capacity - 1, updatedAtMs: nowMs });
      return true;
    }
    const elapsedSeconds = Math.max(0, (nowMs - bucket.updatedAtMs) / 1000);
    bucket.tokens = Math.min(
      this.capacity,
      bucket.tokens + elapsedSeconds * this.refillPerSecond,
    );
    bucket.updatedAtMs = nowMs;
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  private evictOldestIfFull(): void {
    if (this.buckets.size < this.maxKeys) return;
    const oldest = this.buckets.keys().next().value;
    if (oldest !== undefined) this.buckets.delete(oldest);
  }
}