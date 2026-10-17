import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { FleetStatus } from '../../common/constant/domain.constant.js';
import { decimalTransformer } from '../column-transformers.js';

@Entity({ name: 'fleet' })
export class Fleet {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'text' })
  kode!: string;

  @Column({ type: 'text', nullable: true })
  plat!: string | null;

  @Column({ type: 'text', name: 'driver_nama', nullable: true })
  driverNama!: string | null;

  @Column({ type: 'text', name: 'driver_kontak', nullable: true })
  driverKontak!: string | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    name: 'kapasitas_kg',
    nullable: true,
    transformer: decimalTransformer,
  })
  kapasitasKg!: number | null;

  @Column({ type: 'text', name: 'status_operasional', default: 'OFFLINE' })
  statusOperasional!: FleetStatus;

  @Column({ type: 'double precision', name: 'last_lat', nullable: true })
  lastLat!: number | null;

  @Column({ type: 'double precision', name: 'last_lng', nullable: true })
  lastLng!: number | null;

  @Column({
    type: 'timestamptz',
    name: 'last_device_timestamp',
    nullable: true,
  })
  lastDeviceTimestamp!: Date | null;

  @Column({ type: 'timestamptz', name: 'device_revoked_at', nullable: true })
  deviceRevokedAt!: Date | null;

  @Column({ type: 'boolean', default: true })
  aktif!: boolean;

  @Column({ type: 'boolean', name: 'is_demo', default: false })
  isDemo!: boolean;
}