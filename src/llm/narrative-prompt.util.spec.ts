import { describe, expect, it } from '@jest/globals';
import type { NarrativeFacts } from './llm.types.js';
import {
  buildNarrativeMessages,
  narrativePromptChars,
} from './narrative-prompt.util.js';

const facts: NarrativeFacts = {
  tanggal: '2026-10-17',
  cakupan: 'semua',
  batch: {
    total: 12,
    totalKg: 345.5,
    gate: { lolos: 8, perbaiki: 2, alihkan: 1, tolak: 1 },
    menungguPutusan: 3,
  },
  sebelumnya: { total: 10, totalKg: 300 },
  anomaliTerbuka: [{ jenis: 'RANTAI_TIMPA', tingkat: 'KRITIS', jumlah: 1 }],
  tiketBaru: 2,
  adaDataDemo: false,
};

describe('buildNarrativeMessages', () => {
  it('menghasilkan tepat satu pesan sistem dan satu pesan data', () => {
    const messages = buildNarrativeMessages(facts);
    expect(messages.map((message) => message.role)).toEqual(['system', 'user']);
    expect(Object.isFrozen(messages)).toBe(true);
  });

  it('hanya mengirim angka dan kode enum tanpa teks bebas', () => {
    const [, user] = buildNarrativeMessages(facts);
    const payload = JSON.parse(
      (user?.content ?? '').replace('DATA:\n', ''),
    ) as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual([
      'adaDataDemo',
      'anomaliTerbuka',
      'batchTotal',
      'beratKg',
      'cakupan',
      'gerbang',
      'hariSebelumnya',
      'menungguPutusan',
      'tanggal',
      'tiketBaru',
    ]);
    expect(payload.gerbang).toEqual({
      lolos: 8,
      perbaiki: 2,
      alihkan: 1,
      tolak: 1,
    });
  });

  it('memuat instruksi anti PII dan anti tautan di pesan sistem', () => {
    const [system] = buildNarrativeMessages(facts);
    expect(system?.content).toContain('Jangan menyebut nama orang');
    expect(system?.content).toContain('Jangan menebak penyebab');
    expect(system?.content).toContain('versi=1');
  });

  it('menjaga ukuran prompt tetap kecil', () => {
    expect(narrativePromptChars(facts)).toBeLessThan(1200);
  });
});