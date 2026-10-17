import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { UserRole } from '../../common/constant/domain.constant.js';

@Entity({ name: 'user' })
export class User {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'text', unique: true })
  username!: string;

  @Column({ type: 'text', name: 'password_hash', select: false })
  passwordHash!: string;

  @Column({ type: 'text' })
  nama!: string;

  @Column({ type: 'text' })
  role!: UserRole;

  @Column({ type: 'uuid', name: 'sppg_id', nullable: true })
  sppgId!: string | null;

  @Column({ type: 'uuid', name: 'fasilitas_id', nullable: true })
  facilityId!: string | null;

  @Column({ type: 'uuid', name: 'fleet_id', nullable: true })
  fleetId!: string | null;

  @Column({ type: 'boolean', default: true })
  aktif!: boolean;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt!: Date;
}
