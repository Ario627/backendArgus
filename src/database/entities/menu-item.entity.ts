import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { MenuComponent } from '../../common/constant/domain.constant.js';
import { decimalTransformer } from '../column-transformers.js';

@Entity({ name: 'menu_item' })
export class MenuItem {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'text' })
  nama!: string;

  @Column({ type: 'text' })
  komponen!: MenuComponent;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    name: 'biaya_rp',
    nullable: true,
    transformer: decimalTransformer,
  })
  biayaRp!: number | null;

  @Column({ type: 'boolean', default: true })
  aktif!: boolean;
}