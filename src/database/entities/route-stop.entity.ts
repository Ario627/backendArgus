import { Column, Entity, PrimaryColumn } from 'typeorm';
import type {
  RouteStopKind,
  RouteStopStatus,
} from '../../common/constant/domain.constant.js';

@Entity({ name: 'route_stop' })
export class RouteStop {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid', name: 'plan_id' })
  planId!: string;

  @Column({ type: 'uuid', name: 'batch_id' })
  batchId!: string;

  @Column({ type: 'uuid', name: 'fleet_id', nullable: true })
  fleetId!: string | null;

  @Column({ type: 'int' })
  urutan!: number;

  @Column({ type: 'text' })
  jenis!: RouteStopKind;

  @Column({ type: 'uuid', name: 'fasilitas_id', nullable: true })
  fasilitasId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  eta!: Date | null;

  @Column({ type: 'text', default: 'RENCANA' })
  status!: RouteStopStatus;
}