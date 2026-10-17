import { describe, expect, it } from '@jest/globals';
import { TelemetryRateLimiter } from './telemetry-rate-limiter.util.js';

describe('TelemetryRateLimiter', () => {
  it('mengizinkan ledakan sampai kapasitas lalu menahan', () => {
    const limiter = new TelemetryRateLimiter(5, 1);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(limiter.tryConsume('fleet-1', 0)).toBe(true);
    }
    expect(limiter.tryConsume('fleet-1', 0)).toBe(false);
  });

  it('mengisi ulang token sesuai laju per detik', () => {
    const limiter = new TelemetryRateLimiter(2, 1);
    expect(limiter.tryConsume('fleet-1', 0)).toBe(true);
    expect(limiter.tryConsume('fleet-1', 0)).toBe(true);
    expect(limiter.tryConsume('fleet-1', 0)).toBe(false);
    expect(limiter.tryConsume('fleet-1', 1000)).toBe(true);
    expect(limiter.tryConsume('fleet-1', 1000)).toBe(false);
  });

  it('memisahkan kuota antar kunci', () => {
    const limiter = new TelemetryRateLimiter(1, 10);
    expect(limiter.tryConsume('fleet-1', 0)).toBe(true);
    expect(limiter.tryConsume('fleet-1', 0)).toBe(false);
    expect(limiter.tryConsume('fleet-2', 0)).toBe(true);
  });

  it('membatasi jumlah kunci aktif agar memori tidak tumbuh tanpa batas', () => {
    const limiter = new TelemetryRateLimiter(1, 10, 2);
    expect(limiter.tryConsume('a', 0)).toBe(true);
    expect(limiter.tryConsume('b', 0)).toBe(true);
    expect(limiter.tryConsume('c', 0)).toBe(true);
    expect(limiter.tryConsume('a', 0)).toBe(true);
  });
});