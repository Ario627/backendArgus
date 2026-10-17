import type {
  TicketKind,
  TicketStatus,
} from '../common/constant/domain.constant.js';
import type { Ticket } from '../database/entities/ticket.entity.js';
import type { TicketEvent } from '../database/entities/ticket-event.entity.js';

export interface TicketDto {
  readonly id: string;
  readonly sppgId: string;
  readonly jenis: TicketKind;
  readonly deskripsi: string;
  readonly fotoHash: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly status: TicketStatus;
  readonly jawabanSppg: string | null;
  readonly jawabanAt: string | null;
  readonly skorRisiko: number | null;
  readonly isDemo: boolean;
  readonly createdAt: string;
}

export interface TicketEventDto {
  readonly id: string;
  readonly dariStatus: TicketStatus | null;
  readonly keStatus: TicketStatus;
  readonly aktor: string | null;
  readonly catatan: string | null;
  readonly ts: string;
}

export interface TicketDetailDto extends TicketDto {
  readonly riwayat: readonly TicketEventDto[];
}

export interface PublicTicketCreatedDto {
  readonly id: string;
  readonly jenis: TicketKind;
  readonly status: TicketStatus;
  readonly createdAt: string;
}

export interface PublicSppgDto {
  readonly nama: string;
  readonly alamat: string | null;
}

export const toTicketDto = (ticket: Ticket): TicketDto => ({
  id: ticket.id,
  sppgId: ticket.sppgId,
  jenis: ticket.jenis,
  deskripsi: ticket.deskripsi,
  fotoHash: ticket.fotoHash,
  lat: ticket.lat,
  lng: ticket.lng,
  status: ticket.status,
  jawabanSppg: ticket.jawabanSppg,
  jawabanAt: ticket.jawabanAt?.toISOString() ?? null,
  skorRisiko: ticket.skorRisiko,
  isDemo: ticket.isDemo,
  createdAt: ticket.createdAt.toISOString(),
});

export const toTicketEventDto = (event: TicketEvent): TicketEventDto => ({
  id: event.id,
  dariStatus: event.dariStatus,
  keStatus: event.keStatus,
  aktor: event.aktor,
  catatan: event.catatan,
  ts: event.ts.toISOString(),
});

export const toTicketDetailDto = (
  ticket: Ticket,
  riwayat: readonly TicketEvent[],
): TicketDetailDto => ({
  ...toTicketDto(ticket),
  riwayat: Object.freeze(riwayat.map(toTicketEventDto)),
});

export const toPublicTicketCreatedDto = (
  ticket: Ticket,
): PublicTicketCreatedDto => ({
  id: ticket.id,
  jenis: ticket.jenis,
  status: ticket.status,
  createdAt: ticket.createdAt.toISOString(),
});

export const toPublicSppgDto = (row: {
  readonly nama: string;
  readonly alamat: string | null;
}): PublicSppgDto => ({
  nama: row.nama,
  alamat: row.alamat,
});