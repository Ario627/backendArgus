import { Column, Entity, PrimaryColumn } from 'typeorm';
import type {
  AnomalyKind,
  AnomalySeverity,
} from '../../common/constant/domain.constant.js';

@Entity({ name: 'anomali' })
export class Anomaly {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid', name: 'batch_id' })
  batchId!: string;

  @Column({ type: 'text' })
  jenis!: AnomalyKind;

  @Column({ type: 'text' })
  tingkat!: AnomalySeverity;

  @Column({ type: 'jsonb' })
  detail!: Record<string, unknown>;

  @Column({ type: 'timestamptz', name: 'dibuka_at', default: () => 'now()' })
  dibukaAt!: Date;

  @Column({ type: 'timestamptz', name: 'ditutup_at', nullable: true })
  ditutupAt!: Date | null;

  @Column({ type: 'uuid', name: 'ditutup_oleh', nullable: true })
  ditutupOleh!: string | null;

  @Column({ type: 'boolean', name: 'is_demo', default: false })
  isDemo!: boolean;
}