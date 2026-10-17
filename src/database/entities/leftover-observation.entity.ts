import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'observasi_sisa' })
export class LeftoverObservation {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'date' })
  tanggal!: string;

  @Column({ type: 'uuid', name: 'sppg_id' })
  sppgId!: string;

  @Column({ type: 'uuid', name: 'titik_id' })
  titikId!: string;

  @Column({ type: 'uuid', name: 'menu_item_id' })
  menuItemId!: string;

  @Column({ type: 'smallint', name: 'tingkat_sisa' })
  tingkatSisa!: number;

  @Column({ type: 'int', name: 'jumlah_porsi_dinilai' })
  jumlahPorsiDinilai!: number;

  @Column({ type: 'uuid', name: 'dinilai_oleh', nullable: true })
  dinilaiOleh!: string | null;

  @Column({ type: 'uuid', name: 'client_event_id', nullable: true })
  clientEventId!: string | null;

  @Column({ type: 'boolean', name: 'is_demo', default: false })
  isDemo!: boolean;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt!: Date;
}