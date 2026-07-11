import { FleetEntity } from "./fleet.entity";
import { HardwareStatus } from "src/common/constant/operational-status.constant";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('telemetry')
@Index(['fleetId', 'deviceTimestamp'])
@Index(['deviceTimestamp'])
export class TelemetryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', name: 'fleet_id' })
  fleetId!: string;

  @ManyToOne(() => FleetEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fleet_id', referencedColumnName: 'id' })
  fleet!: FleetEntity;

  @Column({ type: 'double precision' })
  latitude!: number;

  @Column({ type: 'double precision' })
  longitude!: number;

  @Column({ name: 'speed_kmh', type: 'double precision' })
  speedKmh!: number;

  @Column({ name: 'volume_percent', type: 'smallint' })
  volumePercent!: number;

  @Column({ name: 'hardware_status', type: 'varchar' })
  hardwareStatus!: HardwareStatus;

  @Column({ name: 'device_timestamp', type: 'timestamptz' })
  deviceTimestamp!: Date;

  @Column({ name: 'received_at', type: 'timestamptz', default: () => 'now()' })
  receivedAt!: Date;

  @Column({ name: 'ingested_at', type: 'timestamptz', default: () => 'now()' })
  ingestedAt!: Date;
}