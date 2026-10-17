import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { ParameterSource } from '../../common/constant/domain.constant.js';
import { decimalTransformer } from '../column-transformers.js';

@Entity({ name: 'parameter_kalibrasi' })
export class ParameterKalibrasi {
  @PrimaryColumn({ type: 'text' })
  kunci!: string;

  @Column({ type: 'numeric', nullable: true, transformer: decimalTransformer })
  nilai!: number | null;

  @Column({ type: 'text', nullable: true })
  satuan!: string | null;

  @Column({ type: 'text' })
  sumber!: ParameterSource;

  @Column({ type: 'text', nullable: true })
  catatan!: string | null;

  @Column({ type: 'uuid', name: 'updated_by', nullable: true })
  updatedBy!: string | null;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt!: Date;
}