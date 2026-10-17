import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { DistributionPointKind } from '../../common/constant/domain.constant.js';

@Entity({ name: 'titik_distribusi' })
export class DistributionPoint {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid', name: 'sppg_id' })
  sppgId!: string;

  @Column({ type: 'text' })
  nama!: string;

  @Column({ type: 'text' })
  jenis!: DistributionPointKind;

  @Column({ type: 'double precision', nullable: true })
  lat!: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng!: number | null;

  @Column({ type: 'boolean', default: true })
  aktif!: boolean;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt!: Date;
}
