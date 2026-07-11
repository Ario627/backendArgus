import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { FleetPosition } from 'src/common/types';

export interface TelemetryEvent {
  type: 'fleet_position' | 'destination_update';
  fleetId?: string;
  data: Record<string, unknown>;
}


@Injectable()
export class TelemetryEventsService {
  readonly stream = new Subject<TelemetryEvent>();

  emitFleetPosition(position: FleetPosition): void {
    this.stream.next({ type: 'fleet_position', fleetId: position.fleetId, data: position as unknown as Record<string, unknown> });
  }

  emitDestinationUpdate(data: Record<string, unknown>): void {
    this.stream.next({ type: 'destination_update', data });
  }
}
