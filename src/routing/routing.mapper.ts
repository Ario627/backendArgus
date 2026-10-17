import type {
  MatrixSource,
  RouteSource,
  RouteStatus,
  RouteStopKind,
  RouteStopStatus,
} from '../common/constant/domain.constant.js';
import type { RoutePlan } from '../database/entities/route-plan.entity.js';
import type { RouteStop } from '../database/entities/route-stop.entity.js';
import type { RoutePlanSummary } from './route-summary.types.js';

export interface RouteStopDto {
  readonly id: string;
  readonly planId: string;
  readonly batchId: string;
  readonly fleetId: string | null;
  readonly urutan: number;
  readonly jenis: RouteStopKind;
  readonly fasilitasId: string | null;
  readonly eta: string | null;
  readonly status: RouteStopStatus;
}

export interface RoutePlanDto {
  readonly id: string;
  readonly sppgId: string | null;
  readonly tanggal: string;
  readonly status: RouteStatus;
  readonly source: RouteSource;
  readonly matrixSource: MatrixSource;
  readonly lowConfidence: boolean;
  readonly totalKg: number;
  readonly totalKm: number | null;
  readonly finalStopId: string | null;
  readonly dibuatOleh: string | null;
  readonly isDemo: boolean;
  readonly createdAt: string;
  readonly ringkasan: RoutePlanSummary | null;
}

export interface RoutePlanDetailDto extends RoutePlanDto {
  readonly stops: readonly RouteStopDto[];
}

export const toRouteStopDto = (stop: RouteStop): RouteStopDto => ({
  id: stop.id,
  planId: stop.planId,
  batchId: stop.batchId,
  fleetId: stop.fleetId,
  urutan: stop.urutan,
  jenis: stop.jenis,
  fasilitasId: stop.fasilitasId,
  eta: stop.eta?.toISOString() ?? null,
  status: stop.status,
});

export const toRoutePlanDto = (plan: RoutePlan): RoutePlanDto => ({
  id: plan.id,
  sppgId: plan.sppgId,
  tanggal: plan.tanggal,
  status: plan.status,
  source: plan.source,
  matrixSource: plan.matrixSource,
  lowConfidence: plan.matrixSource === 'haversine',
  totalKg: plan.totalKg,
  totalKm: plan.totalKm,
  finalStopId: plan.finalStopId,
  dibuatOleh: plan.dibuatOleh,
  isDemo: plan.isDemo,
  createdAt: plan.createdAt.toISOString(),
  ringkasan: plan.ringkasan,
});

export const toRoutePlanDetailDto = (
  plan: RoutePlan,
  stops: readonly RouteStop[],
): RoutePlanDetailDto => ({
  ...toRoutePlanDto(plan),
  stops: Object.freeze(stops.map(toRouteStopDto)),
});