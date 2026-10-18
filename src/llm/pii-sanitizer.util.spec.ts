import { describe, expect, it } from '@jest/globals';
import {
  redactSensitive,
  sanitizeNarrative,
  stripMarkup,
} from './pii-sanitizer.util.js';

describe('stripMarkup', () => {
  it('membuang tag dan karakter kendali tanpa menghapus baris', () => {
    const hasil = stripMarkup('<b>Tiga</b> batch\u0000 lolos\n\n\nSelesai');
    expect(hasil).toBe(' Tiga batch lolos\n\nSelesai');
  });
});

describe('stripMarkup emoji', () => {
  it('membuang emoji dan penanda variasi dari keluaran model', () => {
    expect(stripMarkup('Tiga batch lolos \u{1F35A}\uFE0F mantap')).toBe(
      'Tiga batch lolos mantap',
    );
  });
});

describe('redactSensitive', () => {
  it('menyamarkan email, tautan, NIK, telepon, dan koordinat', () => {
    const hasil = redactSensitive(
      'Hubungi 081234567890 atau staf@example.com, NIK 3273010101900001, koordinat -6.9147441, 107.6098110, lihat https://contoh.id/x',
    );
    expect(hasil.text).not.toContain('081234567890');
    expect(hasil.text).not.toContain('staf@example.com');
    expect(hasil.text).not.toContain('3273010101900001');
    expect(hasil.text).not.toContain('https://contoh.id/x');
    expect(hasil.text).not.toContain('107.6098110');
    expect(hasil.redactions).toBeGreaterThanOrEqual(5);
  });

  it('tidak menyentuh angka agregat pendek', () => {
    const hasil = redactSensitive('12 batch, 345 kg, 7 tiket, 88 persen');
    expect(hasil.text).toBe('12 batch, 345 kg, 7 tiket, 88 persen');
    expect(hasil.redactions).toBe(0);
  });
});

describe('sanitizeNarrative', () => {
  it('menormalkan spasi, membuang tag, dan membatasi jumlah kalimat', () => {
    const hasil = sanitizeNarrative(
      '<p>Hari ini   ada 3 batch.</p>\n\nKalimat kedua. Kalimat ketiga. Kalimat keempat. Kalimat kelima.',
      700,
    );
    expect(hasil.text).not.toContain('<p>');
    expect(
      hasil.text.split('.').filter((part) => part.trim().length > 0),
    ).toHaveLength(4);
    expect(hasil.text).toBe(
      'Hari ini ada 3 batch. Kalimat kedua. Kalimat ketiga. Kalimat keempat.',
    );
  });

  it('memotong dan menandai narasi yang melewati batas karakter', () => {
    const hasil = sanitizeNarrative(
      'Kalimat panjang sekali yang jauh melebihi batas karakter yang diizinkan sistem.',
      20,
    );
    expect(hasil.text.length).toBeLessThanOrEqual(20);
    expect(hasil.text.endsWith('…')).toBe(true);
  });

  it('mempertahankan narasi pendek apa adanya', () => {
    expect(sanitizeNarrative('Tiga batch lolos gerbang.', 700)).toEqual({
      text: 'Tiga batch lolos gerbang.',
      redactions: 0,
    });
  });
});