import { describe, expect, it } from '@jest/globals';
import { resolveRetentionWindows } from './retention-policy.util.js';

describe('resolveRetentionWindows', () => {
  const now = new Date('2026-10-17T04:00:00.000Z');

  it('menghitung batas potong telemetri dan foto dari kebijakan hari', () => {
    const windows = resolveRetentionWindows({
      now,
      dropAfterDays: 90,
      photoTicketDays: 366,
      photoBatchDays: 731,
    });
    expect(windows.telemetryBefore.toISOString()).toBe(
      '2026-07-19T04:00:00.000Z',
    );
    expect(windows.photoTicketBefore.toISOString()).toBe(
      '2025-10-16T04:00:00.000Z',
    );
    expect(windows.photoBatchBefore.toISOString()).toBe(
      '2024-10-16T04:00:00.000Z',
    );
  });

  it('membekukan hasil dan tetap wajar saat kebijakan nol hari', () => {
    const windows = resolveRetentionWindows({
      now,
      dropAfterDays: 0,
      photoTicketDays: 0,
      photoBatchDays: 0,
    });
    expect(Object.isFrozen(windows)).toBe(true);
    expect(windows.telemetryBefore.toISOString()).toBe(now.toISOString());
  });
});