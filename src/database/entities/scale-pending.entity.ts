import { Column, Entity, PrimaryColumn } from 'typeorm';
import { decimalTransformer } from '../column-transformers.js';

@Entity({ name: 'penimbangan_menunggu' })
export class ScalePending {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid', name: 'device_id' })
  deviceId!: string;

  @Column({ type: 'uuid', name: 'sppg_id' })
  sppgId!: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    name: 'berat_kg',
    transformer: decimalTransformer,
  })
  beratKg!: number;

  @Column({ type: 'timestamptz', name: 'occurred_at' })
  occurredAt!: Date;

  @Column({ type: 'timestamptz', name: 'received_at', default: () => 'now()' })
  receivedAt!: Date;

  @Column({ type: 'uuid', name: 'dipakai_batch_id', nullable: true })
  dipakaiBatchId!: string | null;

  @Column({ type: 'timestamptz', name: 'ditautkan_at', nullable: true })
  ditautkanAt!: Date | null;

  @Column({ type: 'uuid', name: 'ditautkan_oleh', nullable: true })
  ditautkanOleh!: string | null;

  @Column({ type: 'timestamptz', name: 'diarsipkan_at', nullable: true })
  diarsipkanAt!: Date | null;

  @Column({ type: 'boolean', name: 'is_demo', default: false })
  isDemo!: boolean;
}