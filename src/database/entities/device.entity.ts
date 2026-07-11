import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DeviceStatus {
  UNASSIGNED = 'unassigned',
  ASSIGNED = 'assigned',
  REVOKED = 'revoked',
}

@Entity('devices')
@Index(['deviceId'], { unique: true })
@Index(['fleetId'])
export class DeviceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'device_id', type: 'varchar', length: 64, unique: true })
  deviceId!: string;

  @Column({ name: 'secret', type: 'varchar', length: 128, nullable: true })
  secret!: string | null;

  @Column({ name: 'fleet_id', type: 'uuid', nullable: true })
  fleetId!: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: DeviceStatus,
    default: DeviceStatus.UNASSIGNED,
  })
  status!: DeviceStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}