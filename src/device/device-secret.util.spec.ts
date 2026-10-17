import { describe, expect, it } from '@jest/globals';
import {
  decryptDeviceSecret,
  encryptDeviceSecret,
  generateDeviceSecret,
  parseDeviceEncKey,
} from './device-secret.util.js';

const KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('generateDeviceSecret', () => {
  it('menghasilkan 32 byte heksadesimal acak dan tidak berulang', () => {
    const first = generateDeviceSecret();
    const second = generateDeviceSecret();
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(second);
  });
});

describe('parseDeviceEncKey', () => {
  it('menerima 64 karakter heksadesimal dan menolak selainnya', () => {
    expect(parseDeviceEncKey(KEY_HEX)).toHaveLength(32);
    expect(() => parseDeviceEncKey('zz'.repeat(32))).toThrow(
      'DEVICE_SECRET_ENC_KEY_INVALID',
    );
    expect(() => parseDeviceEncKey('abcd')).toThrow(
      'DEVICE_SECRET_ENC_KEY_INVALID',
    );
  });
});

describe('encryptDeviceSecret', () => {
  it('roundtrip utuh dan menghasilkan amplop v1 dengan empat bagian', () => {
    const key = parseDeviceEncKey(KEY_HEX);
    const secret = generateDeviceSecret();
    const envelope = encryptDeviceSecret(secret, key);
    expect(envelope.startsWith('v1.')).toBe(true);
    expect(envelope.split('.')).toHaveLength(4);
    expect(decryptDeviceSecret(envelope, key)).toBe(secret);
  });

  it('menghasilkan ciphertext berbeda tiap enkripsi (IV acak)', () => {
    const key = parseDeviceEncKey(KEY_HEX);
    const secret = generateDeviceSecret();
    expect(encryptDeviceSecret(secret, key)).not.toBe(
      encryptDeviceSecret(secret, key),
    );
  });
});

describe('decryptDeviceSecret', () => {
  it('mengembalikan null saat amplop rusak, versi salah, atau kunci berbeda', () => {
    const key = parseDeviceEncKey(KEY_HEX);
    const envelope = encryptDeviceSecret(generateDeviceSecret(), key);
    const parts = envelope.split('.');
    const tamperedCt = [parts[0], parts[1], parts[2], 'ff'.repeat(32)].join('.');
    expect(decryptDeviceSecret('bukan-amplop', key)).toBeNull();
    expect(decryptDeviceSecret('v2.a.b.c', key)).toBeNull();
    expect(decryptDeviceSecret(tamperedCt, key)).toBeNull();
    expect(
      decryptDeviceSecret(envelope, parseDeviceEncKey('ff'.repeat(32))),
    ).toBeNull();
  });
});