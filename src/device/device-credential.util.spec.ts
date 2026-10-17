import { describe, expect, it } from '@jest/globals';
import {
  generateMqttPassword,
  generateMqttUsername,
  mosquittoPasswordHash,
} from './device-credential.util.js';

const base64DecodedLength = (value: string): number => {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return (value.length / 4) * 3 - padding;
};

describe('generateMqttUsername', () => {
  it('berpola dev_ + 8 hex dan berbeda antar panggilan', () => {
    const first = generateMqttUsername();
    expect(first).toMatch(/^dev_[0-9a-f]{8}$/);
    expect(first).not.toBe(generateMqttUsername());
  });
});

describe('generateMqttPassword', () => {
  it('menghasilkan 24 karakter base64url', () => {
    const password = generateMqttPassword();
    expect(password).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(password).not.toBe(generateMqttPassword());
  });
});

describe('mosquittoPasswordHash', () => {
  it('mengikuti format mosquitto $7$1000$salt$hash', () => {
    const hash = mosquittoPasswordHash('rahasia123');
    const parts = hash.split('$');
    expect(parts).toHaveLength(5);
    expect(parts[1]).toBe('7');
    expect(parts[2]).toBe('1000');
    expect(base64DecodedLength(parts[3] ?? '')).toBe(12);
    expect(base64DecodedLength(parts[4] ?? '')).toBe(64);
  });

  it('menghasilkan salt berbeda setiap pemanggilan', () => {
    expect(mosquittoPasswordHash('sama')).not.toBe(
      mosquittoPasswordHash('sama'),
    );
  });
});