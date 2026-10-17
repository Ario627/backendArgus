import { describe, expect, it } from '@jest/globals';
import { topicMatchesFilter } from './topic-match.util.js';

describe('topicMatchesFilter', () => {
  it('cocok untuk topik identik', () => {
    expect(topicMatchesFilter('fleet/abc/telemetry', 'fleet/abc/telemetry')).toBe(true);
  });

  it('memperlakukan + sebagai satu level tepat', () => {
    expect(topicMatchesFilter('fleet/+/telemetry', 'fleet/0192/telemetry')).toBe(true);
    expect(topicMatchesFilter('fleet/+/telemetry', 'fleet/0192/x/telemetry')).toBe(false);
    expect(topicMatchesFilter('+', 'a')).toBe(true);
    expect(topicMatchesFilter('+', 'a/b')).toBe(false);
  });

  it('memperlakukan # di akhir sebagai sisa level termasuk nol level', () => {
    expect(topicMatchesFilter('#', 'a/b/c')).toBe(true);
    expect(topicMatchesFilter('a/#', 'a/b/c')).toBe(true);
    expect(topicMatchesFilter('a/#', 'a')).toBe(true);
    expect(topicMatchesFilter('a/#', 'b/c')).toBe(false);
  });

  it('menolak # yang bukan level terakhir dan filter lebih panjang dari topik', () => {
    expect(topicMatchesFilter('a/#/b', 'a/x/b')).toBe(false);
    expect(topicMatchesFilter('a/+/c', 'a/b')).toBe(false);
  });

  it('menolak topik yang lebih dalam dari filter', () => {
    expect(topicMatchesFilter('fleet/abc/telemetry', 'fleet/abc/telemetry/extra')).toBe(false);
    expect(topicMatchesFilter('fleet/abc/telemetry', 'scale/abc/weight')).toBe(false);
  });
});