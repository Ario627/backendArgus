import { fromHundredths, toHundredths } from '../common/utils/decimal.util.js';
import type { LedgerEvent } from '../database/entities/ledger-event.entity.js';
import type { TransferSide } from './ledger-permission.util.js';

export const TRANSFER_STATUSES = Object.freeze(['SAH', 'MENUNGGU_KONFIRMASI'] as const);
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export interface TransferWitness {
  readonly eventId: number;
  readonly actorId: string | null;
  readonly side: TransferSide;
  readonly weightKg: number;
}

export interface TransferEvaluation {
  readonly status: TransferStatus | null;
  readonly senderKg: number | null;
  readonly receiverKg: number | null;
  readonly handedOverKg: number | null;
  readonly diffKg: number | null;
  readonly withinTolerance: boolean | null;
  readonly notes: readonly string[];
}

const averageKg = (values: readonly number[]): number => {
  let totalHundredths = 0;
  for (const value of values) {
    totalHundredths += toHundredths(value);
  }
  return fromHundredths(Math.round(totalHundredths / values.length));
};

const readSide = (payload: Record<string, unknown>): TransferSide | null => {
  const data = payload['data'];
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return null;
  const sisi = (data as Record<string, unknown>)['sisi'];
  return sisi === 'KIRIM' || sisi === 'TERIMA' ? sisi : null;
};

const actorsOf = (witnesses: readonly TransferWitness[], side: TransferSide): ReadonlySet<string> => {
  const actors = new Set<string>();
  for (const witness of witnesses) {
    if (witness.side === side && witness.actorId !== null) {
      actors.add(witness.actorId);
    }
  }
  return actors;
};

const hasDistinctActors = (witnesses: readonly TransferWitness[]): boolean => {
  const senders = actorsOf(witnesses, 'KIRIM');
  const receivers = actorsOf(witnesses, 'TERIMA');
  if (senders.size === 0 || receivers.size === 0) return false;
  for (const sender of senders) {
    for (const receiver of receivers) {
      if (sender !== receiver) return true;
    }
  }
  return false;
};

export const extractTransferWitnesses = (
  rows: readonly LedgerEvent[],
): readonly TransferWitness[] => {
  const witnesses: TransferWitness[] = [];
  for (const row of rows) {
    if (row.tipe !== 'SERAH_TERIMA' || row.beratKg === null) continue;
    const side = readSide(row.payload);
    if (side === null) continue;
    witnesses.push({ eventId: row.id, actorId: row.aktor, side, weightKg: row.beratKg });
  }
  return witnesses;
};

export const evaluateTransfer = (
  witnesses: readonly TransferWitness[],
  toleranceProksi: number | null,
): TransferEvaluation => {
  const senderWeights = witnesses
    .filter((witness) => witness.side === 'KIRIM')
    .map((witness) => witness.weightKg);
  const receiverWeights = witnesses
    .filter((witness) => witness.side === 'TERIMA')
    .map((witness) => witness.weightKg);

  if (senderWeights.length === 0 && receiverWeights.length === 0) {
    return Object.freeze({
      status: null,
      senderKg: null,
      receiverKg: null,
      handedOverKg: null,
      diffKg: null,
      withinTolerance: null,
      notes: Object.freeze([]),
    });
  }

  const senderKg = senderWeights.length > 0 ? averageKg(senderWeights) : null;
  const receiverKg = receiverWeights.length > 0 ? averageKg(receiverWeights) : null;

  const notes: string[] = [];
  let diffKg: number | null = null;
  let withinTolerance: boolean | null = null;

  if (senderKg !== null && receiverKg !== null) {
    diffKg = fromHundredths(Math.abs(toHundredths(senderKg) - toHundredths(receiverKg)));
    if (toleranceProksi === null) {
      notes.push('TOLERANSI_BELUM_TERKALIBRASI');
    } else {
      withinTolerance =
        toHundredths(diffKg) <= Math.round(toleranceProksi * toHundredths(senderKg));
    }
    if (withinTolerance === false) {
      notes.push('SAKSI_SELISIH_MELEBIHI_TOLERANSI');
    }
  } else if (senderKg === null) {
    notes.push('MENUNGGU_SAKSI_PENGIRIM');
  } else {
    notes.push('MENUNGGU_SAKSI_PENERIMA');
  }

  const distinctActors = hasDistinctActors(witnesses);
  if (!distinctActors && senderKg !== null && receiverKg !== null) {
    notes.push('SAKSI_AKTOR_SAMA');
  }

  const handedOverKg =
    senderKg === null
      ? receiverKg
      : receiverKg === null
        ? senderKg
        : withinTolerance === true
          ? averageKg([senderKg, receiverKg])
          : senderKg;

  const sah =
    senderKg !== null && receiverKg !== null && withinTolerance === true && distinctActors;

  return Object.freeze({
    status: sah ? 'SAH' : 'MENUNGGU_KONFIRMASI',
    senderKg,
    receiverKg,
    handedOverKg,
    diffKg,
    withinTolerance,
    notes: Object.freeze(notes),
  });
};