import { Controller, Logger } from "@nestjs/common";
import { Ctx, MessagePattern, MqttContext, Payload } from "@nestjs/microservices";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { TelemetryPayloadDto } from "src/telemetry/dto/telemetry-payload.dto";
import { TelemetryService } from "src/telemetry/telemetry.service";
import { TelemetryEventsService } from "src/telemetry/telemetry-events.service";
import { DestinationService } from "src/destination/destination.service";
import { TelemetryPayload } from "src/common/types";

const FLEET_TOPIC_RE = /^fleet\/([a-zA-Z0-9-]+)\/telemetry$/;
const DEST_TOPIC_RE = /^telemetry\/destination\/([a-zA-Z0-9-]+)$/;

@Controller()
export class MqttController {
  private readonly logger = new Logger(MqttController.name);

  constructor(
    private readonly telemetryService: TelemetryService,
    private readonly events: TelemetryEventsService,
    private readonly destinationService: DestinationService,
  ) {}

  @MessagePattern('fleet/+/telemetry')
  async handleTelemetry(
    @Payload() data: unknown,
    @Ctx() context?: MqttContext,
  ): Promise<void> {
    const topic = (context as any)?.args?.[0] ?? context?.getTopic?.();

    const rawPacketPayload: unknown =
      (context as any)?.args?.[1]?.payload ?? (data as any)?.payload ?? data;

    if (!topic || typeof topic !== 'string') {
      this.logger.warn(
        `Received telemetry without valid topic — context: ${JSON.stringify({
          hasContext: Boolean(context),
          topicType: typeof topic,
        })}`,
      );
      return;
    }

    const fleetId = this.extractFleetId(topic);
    if (!fleetId) {
      this.logger.warn(`Received telemetry on invalid topic: ${topic}`);
      return;
    }

    const parsed = this.parsePayload(rawPacketPayload);
    if (!parsed) return;

    // Inject fleetId from topic (authoritative source)
    const enriched = { ...parsed, fleetId };

    const dto = plainToInstance(TelemetryPayloadDto, enriched);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      this.logger.warn(
        `Invalid telemetry payload for fleet ${fleetId}: ${errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('; ')}`,
      );
      return;
    }

    await this.telemetryService.ingest(dto as TelemetryPayload);
  }

  @MessagePattern('telemetry/destination/+')
  async handleDestinationTelemetry(
    @Payload() data: unknown,
    @Ctx() context?: MqttContext,
  ): Promise<void> {
    const topic = (context as any)?.args?.[0] ?? context?.getTopic?.();
    const rawPayload: unknown =
      (context as any)?.args?.[1]?.payload ?? (data as any)?.payload ?? data;

    if (!topic || typeof topic !== 'string') {
      this.logger.warn('Destination telemetry without valid topic');
      return;
    }

    const match = DEST_TOPIC_RE.exec(topic);
    if (!match) {
      this.logger.warn(`Invalid destination topic: ${topic}`);
      return;
    }

    const parsed = this.parsePayload(rawPayload);
    if (!parsed) return;

    this.logger.debug(
      `Destination telemetry: id=${match[1]} keys=${Object.keys(parsed).join(',')}`,
    );

    try {
      await this.destinationService.upsertFromTelemetry(parsed);
    } catch (err) {
      this.logger.warn(`Failed to persist destination telemetry: ${(err as Error).message}`);
    }

    this.events.emitDestinationUpdate(parsed);
  }

  private extractFleetId(topic: string): string | null {
    const match = FLEET_TOPIC_RE.exec(topic);
    return match ? match[1] : null;
  }

  private parsePayload(payload: Buffer | string | unknown): Record<string, unknown> | null {
    try {
      if (typeof payload === 'string') return JSON.parse(payload);
      if (Buffer.isBuffer(payload)) return JSON.parse(payload.toString());
      return null;
    } catch (error) {
      this.logger.error('Failed to parse MQTT payload', error);
      return null;
    }
  }
}
