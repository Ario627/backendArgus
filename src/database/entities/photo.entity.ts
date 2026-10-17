import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { PhotoMimeType, PhotoRefType } from '../../common/constant/domain.constant.js';

@Entity({ name: 'foto' })
export class Photo {
  @PrimaryColumn({ type: 'text' })
  sha256!: string;

  @Column({ type: 'text' })
  mime!: PhotoMimeType;

  @Column({ type: 'int' })
  bytes!: number;

  @Column({ type: 'int', nullable: true })
  lebar!: number | null;

  @Column({ type: 'int', nullable: true })
  tinggi!: number | null;

  @Column({ type: 'uuid', name: 'diunggah_oleh', nullable: true })
  diunggahOleh!: string | null;

  @Column({ type: 'text', name: 'ref_tipe' })
  refTipe!: PhotoRefType;

  @Column({ type: 'uuid', name: 'ref_id', nullable: true })
  refId!: string | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt!: Date;
}