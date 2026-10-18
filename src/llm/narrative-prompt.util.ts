import { NARRATIVE_PROMPT_VERSION, type NarrativeFacts } from './llm.types.js';

export interface ChatMessage {
  readonly role: 'system' | 'user';
  readonly content: string;
}

const SYSTEM_PROMPT = [
  'Anda analis operasional dapur MBG yang menulis ringkasan harian untuk pengelola dan pengawas.',
  'Gunakan bahasa Indonesia baku, tenang, tanpa emosi dan tanpa basa-basi.',
  'Tulis 2 sampai 3 kalimat, maksimal 60 kata, satu paragraf.',
  'Aturan wajib:',
  '- Hanya sebut angka yang ada pada DATA. Jangan menghitung angka baru sendiri.',
  '- Jangan menyebut nama orang, nomor telepon, alamat, tautan, atau koordinat.',
  '- Jangan menebak penyebab di luar data. Bila perlu, sebut bahwa penyebab belum diketahui.',
  '- Jangan memberi perintah kepada individu; sebutkan tindakan sebagai saran operasional.',
  '- Bila ada anomali KRITIS, sebutkan paling awal.',
  '- Bila adaDataDemo benar, tutup dengan kalimat bahwa data demo tidak dihitung dalam laporan resmi.',
  '- Jangan mengulang seluruh data; cukup pola penting dan satu saran.',
] as const;

const compactFacts = (facts: NarrativeFacts): Record<string, unknown> => ({
  tanggal: facts.tanggal,
  cakupan: facts.cakupan,
  batchTotal: facts.batch.total,
  beratKg: facts.batch.totalKg,
  gerbang: {
    lolos: facts.batch.gate.lolos,
    perbaiki: facts.batch.gate.perbaiki,
    alihkan: facts.batch.gate.alihkan,
    tolak: facts.batch.gate.tolak,
  },
  menungguPutusan: facts.batch.menungguPutusan,
  hariSebelumnya: {
    batchTotal: facts.sebelumnya.total,
    beratKg: facts.sebelumnya.totalKg,
  },
  anomaliTerbuka: facts.anomaliTerbuka.map((item) => ({
    jenis: item.jenis,
    tingkat: item.tingkat,
    jumlah: item.jumlah,
  })),
  tiketBaru: facts.tiketBaru,
  adaDataDemo: facts.adaDataDemo,
});

export const buildNarrativeMessages = (
  facts: NarrativeFacts,
): readonly ChatMessage[] =>
  Object.freeze([
    Object.freeze({
      role: 'system' as const,
      content: `${SYSTEM_PROMPT.join('\n')}\nversi=${NARRATIVE_PROMPT_VERSION}`,
    }),
    Object.freeze({
      role: 'user' as const,
      content: `DATA:\n${JSON.stringify(compactFacts(facts))}`,
    }),
  ]);

export const narrativePromptChars = (facts: NarrativeFacts): number =>
  buildNarrativeMessages(facts).reduce(
    (total, message) => total + message.content.length,
    0,
  );