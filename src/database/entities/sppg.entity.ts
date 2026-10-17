import { Column, Entity, PrimaryColumn } from 'typeorm';
import { decimalTransformer } from '../column-transformers.js';

@Entity({ name: 'sppg' })
export class Sppg {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'text', name: 'public_slug', unique: true })
  publicSlug!: string;

  @Column({ type: 'text' })
  nama!: string;

  @Column({ type: 'text', nullable: true })
  alamat!: string | null;

  @Column({ type: 'double precision' })
  lat!: number;

  @Column({ type: 'double precision' })
  lng!: number;

  @Column({ type: 'int', name: 'porsi_per_hari' })
  porsiPerHari!: number;

  @Column({ type: 'text', nullable: true })
  mitra!: string | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    name: 'kapasitas_olah_kg',
    nullable: true,
    transformer: decimalTransformer,
  })
  kapasitasOlahKg!: number | null;

  @Column({ type: 'boolean', default: true })
  aktif!: boolean;

  @Column({ type: 'boolean', name: 'is_demo', default: false })
  isDemo!: boolean;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt!: Date;
}
