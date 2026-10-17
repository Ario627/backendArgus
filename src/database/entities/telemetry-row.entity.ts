import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { HardwareStatus } from '../../common/constant/domain.constant.js';
import { decimalTransformer } from '../column-transformers.js';

@Entity({ name: 'telemetry' })
export class TelemetryRow {
  @PrimaryColumn({ type: 'uuid', name: 'fleet_id' })
  fleetId!: string;

  @PrimaryColumn({ type: 'timestamptz', name: 'device_timestamp' })
  deviceTimestamp!: Date;

  @Column({ type: 'timestamptz', name: 'received_at', default: () => 'now()' })
  receivedAt!: Date;

  @Column({ type: 'double precision', nullable: true })
  lat!: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng!: number | null;

  @Column({
    type: 'numeric',
    precision: 6,
    scale: 2,
    name: 'speed_kmh',
    nullable: true,
    transformer: decimalTransformer,
  })
  speedKmh!: number | null;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    name: 'volume_persen',
    nullable: true,
    transformer: decimalTransformer,
  })
  volumePercent!: number | null;

  @Column({ type: 'text', name: 'hardware_status', nullable: true })
  hardwareStatus!: HardwareStatus | null;
}