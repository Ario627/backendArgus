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

  @Column({ type: 'date' })
  planDate!: string;

  @Column({ type: 'jsonb' })
  stops!: RoutePlanStop[];

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  totalKm!: number;

  @Column({ type: 'integer' })
  totalMinutes!: number;

  @Column({ type: 'varchar', default: 'active' })
  status!: RoutePlanStatus;

  @Column({ type: 'boolean', default: false })
  lowConfidence!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}