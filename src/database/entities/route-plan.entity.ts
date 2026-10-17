import { Column, Entity, PrimaryColumn } from 'typeorm';
import type {
  MatrixSource,
  RouteSource,
  RouteStatus,
} from '../../common/constant/domain.constant.js';
import type { RoutePlanSummary } from '../../routing/route-summary.types.js';
import { decimalTransformer } from '../column-transformers.js';

@Entity({ name: 'route_plan' })
export class RoutePlan {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'date' })
  tanggal!: string;

  @Column({ type: 'text' })
  status!: RouteStatus;

  @Column({ type: 'uuid', name: 'sppg_id', nullable: true })
  sppgId!: string | null;

  @Column({ type: 'text' })
  source!: RouteSource;

  @Column({ type: 'text', name: 'matrix_source' })
  matrixSource!: MatrixSource;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    name: 'total_kg',
    transformer: decimalTransformer,
  })
  totalKg!: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    name: 'total_km',
    nullable: true,
    transformer: decimalTransformer,
  })
  totalKm!: number | null;

  @Column({ type: 'uuid', name: 'final_stop_id', nullable: true })
  finalStopId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  ringkasan!: RoutePlanSummary | null;

  @Column({ type: 'uuid', name: 'dibuat_oleh', nullable: true })
  dibuatOleh!: string | null;

  @Column({ type: 'boolean', name: 'is_demo', default: false })
  isDemo!: boolean;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt!: Date;
}