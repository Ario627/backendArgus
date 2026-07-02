import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  HardwareStatus,
  OperationalStatus,
} from '../../common/constant/operational-status.constant';

@Entity('fleet')
@Index(['operationalStatus'])
export class FleetEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'plate_number', type: 'varchar', length: 12, unique: true })
  plateNumber!: string;

  @Column({ name: 'driver_name', type: 'varchar' })
  driverName!: string;

  @Column({ name: 'driver_contact', type: 'varchar', nullable: true })
  driverContact!: string | null;

  @Column({ name: 'capacity_kg', type: 'integer' })
  capacityKg!: number;

  @Column({
    name: 'status_hardware',
    type: 'enum',
    enum: HardwareStatus,
    default: HardwareStatus.NORMAL,
  })
  statusHardware!: HardwareStatus;

  @Column({
    name: 'operational_status',
    type: 'enum',
    enum: OperationalStatus,
    default: OperationalStatus.OFFLINE,
  })
  operationalStatus!: OperationalStatus;

  @Column({ name: 'last_device_timestamp', type: 'timestamptz', nullable: true })
  lastDeviceTimestamp!: Date | null;

  @Column({ name: 'last_lat', type: 'double precision', nullable: true })
  lastLat!: number | null;

  @Column({ name: 'last_lng', type: 'double precision', nullable: true })
  lastLng!: number | null;

  @Column({ name: 'last_volume_percent', type: 'smallint', nullable: true })
  lastVolumePercent!: number | null;

  @Column({
    name: 'last_hardware_status',
    type: 'enum',
    enum: HardwareStatus,
    nullable: true,
  })
  lastHardwareStatus!: HardwareStatus | null;

  @Column({ name: 'device_revoked_at', type: 'timestamptz', nullable: true })
  deviceRevokedAt!: Date | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at',type: 'timestamptz' })
  updatedAt!: Date;
}