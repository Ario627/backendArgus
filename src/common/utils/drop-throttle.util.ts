export class DropThrottle {
  private readonly lastAt = new Map<string, number>();

  constructor(
    private readonly intervalMs: number,
    private readonly maxKeys = 4096,
  ) {}

  shouldLog(key: string, nowMs: number): boolean {
    const lastLoggedAt = this.lastAt.get(key);
    if (lastLoggedAt !== undefined && nowMs - lastLoggedAt < this.intervalMs) {
      return false;
    }
    if (this.lastAt.size >= this.maxKeys) {
      const oldest = this.lastAt.keys().next().value;
      if (oldest !== undefined) this.lastAt.delete(oldest);
    }
    this.lastAt.set(key, nowMs);
    return true;
  }
}