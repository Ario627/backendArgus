import { Column, Entity, PrimaryColumn } from 'typeorm';
import type {
  BatchStatus,
  GateStatus,
  MoistureProxy,
  WasteFlow,
} from '../../common/constant/domain.constant.js';
import { decimalTransformer } from '../column-transformers.js';

@Entity({ name: 'batch' })
export class Batch {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid', name: 'sppg_id' })
  sppgId!: string;

  @Column({ type: 'text' })
  aliran!: WasteFlow;

  @Column({ type: 'timestamptz', name: 'dikeluarkan_at' })
  dikeluarkanAt!: Date;

  @Column({ type: 'numeric', precision: 10, scale: 2, name: 'berat_kg', transformer: decimalTransformer })
  beratKg!: number;

  @Column({ type: 'text', name: 'kadar_air_proksi', nullable: true })
  kadarAirProksi!: MoistureProxy | null;

  @Column({ type: 'boolean', name: 'ada_minyak_terlihat', default: false })
  adaMinyakTerlihat!: boolean;

  @Column({ type: 'text', name: 'tingkat_putusan', nullable: true })
  tingkatPutusan!: string | null;

  @Column({ type: 'jsonb', name: 'alasan_putusan', nullable: true })
  alasanPutusan!: Record<string, unknown> | null;

  @Column({ type: 'text', name: 'gate_status', nullable: true })
  gateStatus!: GateStatus | null;

  @Column({ type: 'jsonb', name: 'gate_detail', nullable: true })
  gateDetail!: Record<string, unknown> | null;

  @Column({ type: 'text', default: 'DICATAT' })
  status!: BatchStatus;

  @Column({ type: 'text', name: 'foto_hash', nullable: true })
  fotoHash!: string | null;

  @Column({ type: 'uuid', name: 'client_event_id', nullable: true })
  clientEventId!: string | null;

  @Column({ type: 'int', name: 'clock_skew_ms', nullable: true })
  clockSkewMs!: number | null;

  @Column({ type: 'boolean', name: 'is_demo', default: false })
  isDemo!: boolean;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt!: Date;
}