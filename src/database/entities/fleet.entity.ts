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

  @Column({ type: 'varchar', length: 12, unique: true })
  plateNumber!: string;

  @Column({ type: 'varchar' })
  driverName!: string;

  @Column({ type: 'varchar', nullable: true })
  driverContact!: string | null;

  @Column({ type: 'integer' })
  capacityKg!: number;

  @Column({
    type: 'enum',
    enum: HardwareStatus,
    default: HardwareStatus.NORMAL,
  })
  statusHardware!: HardwareStatus;

  @Column({
    type: 'enum',
    enum: OperationalStatus,
    default: OperationalStatus.OFFLINE,
  })
  operationalStatus!: OperationalStatus;

  @Column({ type: 'timestamptz', nullable: true })
  lastDeviceTimestamp!: Date | null;

  @Column({ type: 'double precision', nullable: true })
  lastLat!: number | null;

  @Column({ type: 'double precision', nullable: true })
  lastLng!: number | null;

  @Column({ type: 'smallint', nullable: true })
  lastVolumePercent!: number | null;

  @Column({
    type: 'enum',
    enum: HardwareStatus,
    nullable: true,
  })
  lastHardwareStatus!: HardwareStatus | null;

  @Column({ type: 'timestamptz', nullable: true })
  deviceRevokedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}