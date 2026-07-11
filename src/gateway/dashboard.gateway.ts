import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { TelemetryEventsService } from 'src/telemetry/telemetry-events.service';
import type { FleetPosition } from 'src/common/types';
interface ServerToClientEvents {
  'fleet:position': (data: FleetPosition) => void;
  'destination:update': (data: Record<string, unknown>) => void;
  'telemetry:batch': (data: { positions: FleetPosition[] }) => void;
}
interface ClientToServerEvents {
  'subscribe:fleet': () => void;
  'subscribe:destinations': () => void;
  ping: () => void;
}
/**
 * Socket.io gateway for real-time dashboard telemetry.
 * Clients connect via WebSocket to receive live fleet positions
 * and destination updates as they arrive over MQTT.
 */
@WebSocketGateway({
  namespace: '/telemetry',
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})
export class DashboardGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server<ClientToServerEvents, ServerToClientEvents>;
  private readonly logger = new Logger(DashboardGateway.name);
  private connectedClients = 0;
  constructor(private readonly events: TelemetryEventsService) {}
  afterInit(): void {
    this.logger.log('WebSocket gateway initialized on /telemetry');
    this.events.stream.subscribe({
      next: (event) => {
        if (event.type === 'fleet_position') {
          this.server.emit('fleet:position', event.data as unknown as FleetPosition);
        } else if (event.type === 'destination_update') {
          this.server.emit('destination:update', event.data);
        }
      },
      error: (err) => this.logger.error('Telemetry event stream error', err),
    });
  }
  handleConnection(client: Socket): void {
    this.connectedClients++;
    this.logger.log(
      `Client connected: ${client.id} (total: ${this.connectedClients})`,
    );
  }
  handleDisconnect(client: Socket): void {
    this.connectedClients--;
    this.logger.log(
      `Client disconnected: ${client.id} (total: ${this.connectedClients})`,
    );
  }
  @SubscribeMessage('subscribe:fleet')
  handleSubscribeFleet(@ConnectedSocket() client: Socket): void {
    client.join('fleet');
    this.logger.debug(`Client ${client.id} subscribed to fleet positions`);
  }
  @SubscribeMessage('subscribe:destinations')
  handleSubscribeDestinations(@ConnectedSocket() client: Socket): void {
    client.join('destinations');
    this.logger.debug(`Client ${client.id} subscribed to destinations`);
  }
  @SubscribeMessage('ping')
  handlePing(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
