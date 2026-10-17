import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'menu_harian' })
export class MenuServing {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'date' })
  tanggal!: string;

  @Column({ type: 'uuid', name: 'sppg_id' })
  sppgId!: string;

  @Column({ type: 'uuid', name: 'menu_item_id' })
  menuItemId!: string;

  @Column({ type: 'uuid', name: 'titik_id', nullable: true })
  titikId!: string | null;
}