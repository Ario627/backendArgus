import { Column, Entity, Generated, PrimaryColumn } from 'typeorm';
import type { LedgerEventType } from '../../common/constant/domain.constant.js';
import { bigintTransformer, decimalTransformer } from '../column-transformers.js';

@Entity({ name: 'ledger_event' })
export class LedgerEvent {
  @PrimaryColumn({ type: 'bigint', transformer: bigintTransformer })
  @Generated('increment')
  id!: number;

  @Column({ type: 'uuid', name: 'batch_id' })
  batchId!: string;

  @Column({ type: 'text' })
  tipe!: LedgerEventType;

  @Column({ type: 'uuid', nullable: true })
  aktor!: string | null;

  @Column({ type: 'uuid', name: 'device_id', nullable: true })
  deviceId!: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, name: 'berat_kg', nullable: true, transformer: decimalTransformer })
  beratKg!: number | null;

  @Column({ type: 'double precision', nullable: true })
  lat!: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng!: number | null;

  @Column({ type: 'text', name: 'foto_hash', nullable: true })
  fotoHash!: string | null;

  @Column({ type: 'timestamptz', name: 'waktu_kejadian' })
  waktuKejadian!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  ts!: Date;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'text', name: 'prev_hash', nullable: true })
  prevHash!: string | null;

  @Column({ type: 'text' })
  hash!: string;

  @Column({ type: 'uuid', name: 'client_event_id', nullable: true })
  clientEventId!: string | null;

  @Column({ type: 'boolean', name: 'is_demo', default: false })
  isDemo!: boolean;
}