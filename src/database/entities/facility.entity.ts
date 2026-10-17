import { Column, Entity, PrimaryColumn } from 'typeorm';
import type {
  FacilityKind,
  FacilityLevel,
} from '../../common/constant/domain.constant.js';
import { decimalTransformer } from '../column-transformers.js';

@Entity({ name: 'fasilitas' })
export class Facility {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'text' })
  nama!: string;

  @Column({ type: 'text' })
  tingkat!: FacilityLevel;

  @Column({ type: 'text' })
  jenis!: FacilityKind;

  @Column({ type: 'double precision' })
  lat!: number;

  @Column({ type: 'double precision' })
  lng!: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    name: 'kapasitas_kg_hari',
    nullable: true,
    transformer: decimalTransformer,
  })
  kapasitasKgHari!: number | null;

  @Column({ type: 'text', name: 'jam_operasi', nullable: true })
  jamOperasi!: string | null;

  @Column({ type: 'boolean', default: false })
  mitra!: boolean;

  @Column({ type: 'boolean', default: true })
  aktif!: boolean;

  @Column({ type: 'boolean', name: 'is_demo', default: false })
  isDemo!: boolean;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt!: Date;
}
