import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { DeviceType } from '../../common/constant/domain.constant.js';

@Entity({ name: 'device' })
export class Device {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'text' })
  tipe!: DeviceType;

  @Column({ type: 'uuid', name: 'fleet_id', nullable: true })
  fleetId!: string | null;

  @Column({ type: 'uuid', name: 'sppg_id', nullable: true })
  sppgId!: string | null;

  @Column({ type: 'text', name: 'secret_enc', nullable: true })
  secretEnc!: string | null;

  @Column({ type: 'text', name: 'mqtt_username' })
  mqttUsername!: string;

  @Column({ type: 'text', name: 'mqtt_password_hash' })
  mqttPasswordHash!: string;

  @Column({ type: 'text', nullable: true })
  firmware!: string | null;

  @Column({ type: 'timestamptz', name: 'last_seen_at', nullable: true })
  lastSeenAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'last_weight_at', nullable: true })
  lastWeightAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt!: Date;
}