import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { FractionCode } from '../../common/constant/domain.constant.js';
import { decimalTransformer } from '../column-transformers.js';

@Entity({ name: 'batch_fraksi' })
export class BatchFraction {
  @PrimaryColumn({ type: 'uuid', name: 'batch_id' })
  batchId!: string;

  @PrimaryColumn({ type: 'char', length: 1 })
  kode!: FractionCode;

  @Column({ type: 'numeric', precision: 5, scale: 2, transformer: decimalTransformer })
  persen!: number;
}