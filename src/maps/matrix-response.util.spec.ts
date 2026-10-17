import { describe, expect, it } from '@jest/globals';
import { parseMapboxMatrix } from './matrix-response.util.js';

const valid = () => ({
  code: 'Ok',
  durations: [
    [0, 300],
    [300, 0],
  ],
  distances: [
    [0, 1200],
    [1200, 0],
  ],
});

describe('parseMapboxMatrix', () => {
  it('menerima matriks berukuran tepat dan membekukannya', () => {
    const parsed = parseMapboxMatrix(valid(), 2);
    expect(parsed).not.toBeNull();
    expect(parsed?.durationsSeconds[0]?.[1]).toBe(300);
    expect(parsed?.distancesMeters[1]?.[0]).toBe(1200);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed?.durationsSeconds[0])).toBe(true);
  });

  it('menolak code selain Ok, dimensi salah, dan nilai tidak wajar', () => {
    expect(parseMapboxMatrix({ ...valid(), code: 'NoRoute' }, 2)).toBeNull();
    expect(parseMapboxMatrix(valid(), 3)).toBeNull();
    const negative = valid();
    negative.durations[0]![1] = -1;
    expect(parseMapboxMatrix(negative, 2)).toBeNull();
    const notNumber = valid();
    (notNumber.distances[0] as unknown[])[1] = 'jauh';
    expect(parseMapboxMatrix(notNumber, 2)).toBeNull();
    expect(parseMapboxMatrix(null, 2)).toBeNull();
  });

  it('membatasi nilai ekstrem agar tidak merusak perhitungan', () => {
    const extreme = valid();
    extreme.durations[0]![1] = 10 ** 9;
    extreme.distances[0]![1] = 10 ** 12;
    const parsed = parseMapboxMatrix(extreme, 2);
    expect(parsed?.durationsSeconds[0]?.[1]).toBe(172800);
    expect(parsed?.distancesMeters[0]?.[1]).toBe(5000000);
  });
});