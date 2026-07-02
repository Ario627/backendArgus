import { FleetEntity } from "./fleet.entity";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type RouteStopStatus = 'pending' | 'done' | 'redistributed';
export type RoutePlanStatus = 'active' | 'done' | 'cancelled';

export interface RoutePlanStop {
  destId: string;
  order: number;
  etaEpoch: number;
  cumulativeKm: number;
  status: RouteStopStatus;
}

@Entity('route_plan')
@Index(['fleetId', 'planDate'])
export class RoutePlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', name: 'fleet_id' })
  fleetId!: string;

  @ManyToOne(() => FleetEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fleet_id', referencedColumnName: 'id' })
  fleet!: FleetEntity;

  @Column({ name: 'plan_date', type: 'date' })
  planDate!: string;

  @Column({ name: 'stops', type: 'jsonb' })
  stops!: RoutePlanStop[];

  @Column({ name: 'total_km', type: 'numeric', precision: 10, scale: 2 })
  totalKm!: number;

  @Column({ name: 'total_minutes', type: 'integer' })
  totalMinutes!: number;

  @Column({ name: 'status', type: 'varchar', default: 'active' })
  status!: RoutePlanStatus;

  @Column({ name: 'low_confidence', type: 'boolean', default: false })
  lowConfidence!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}