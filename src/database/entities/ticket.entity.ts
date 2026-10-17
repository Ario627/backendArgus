import { Column, Entity, PrimaryColumn } from 'typeorm';
import type {
  TicketKind,
  TicketStatus,
} from '../../common/constant/domain.constant.js';

@Entity({ name: 'tiket_warga' })
export class Ticket {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid', name: 'sppg_id' })
  sppgId!: string;

  @Column({ type: 'text' })
  jenis!: TicketKind;

  @Column({ type: 'text' })
  deskripsi!: string;

  @Column({ type: 'text', name: 'foto_hash', nullable: true })
  fotoHash!: string | null;

  @Column({ type: 'double precision', nullable: true })
  lat!: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng!: number | null;

  @Column({ type: 'text' })
  status!: TicketStatus;

  @Column({ type: 'text', name: 'jawaban_sppg', nullable: true })
  jawabanSppg!: string | null;

  @Column({ type: 'timestamptz', name: 'jawaban_at', nullable: true })
  jawabanAt!: Date | null;

  @Column({ type: 'smallint', name: 'skor_risiko', nullable: true })
  skorRisiko!: number | null;

  @Column({ type: 'text', name: 'ip_hash' })
  ipHash!: string;

  @Column({ type: 'uuid', name: 'client_event_id', nullable: true })
  clientEventId!: string | null;

  @Column({ type: 'boolean', name: 'is_demo', default: false })
  isDemo!: boolean;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt!: Date;
}