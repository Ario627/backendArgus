import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'profil_penerimaan' })
export class AcceptanceProfile {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid', name: 'fasilitas_id' })
  fasilitasId!: string;

  @Column({ type: 'int' })
  versi!: number;

  @Column({ type: 'jsonb' })
  aturan!: Record<string, unknown>;

  @Column({ type: 'timestamptz', name: 'berlaku_dari' })
  berlakuDari!: Date;

  @Column({ type: 'timestamptz', name: 'berlaku_sampai', nullable: true })
  berlakuSampai!: Date | null;

  @Column({ type: 'uuid', name: 'dibuat_oleh', nullable: true })
  dibuatOleh!: string | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt!: Date;
}
