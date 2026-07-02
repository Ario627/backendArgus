import { Controller, Logger } from "@nestjs/common";
import { MessagePattern } from "@nestjs/microservices";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { TelemetryPayloadDto } from "src/telemetry/dto/telemetry-payload.dto";
import { TelemetryService } from "src/telemetry/telemetry.service";
import { TelemetryPayload } from "src/common/types";

const TOPIC_RE = /^fleet\/([a-zA-Z0-9-]+)\/telemetry$/;

@Controller()
export class MqttController{
    private readonly logger = new Logger(MqttController.name);

    constructor(private readonly telemetryService: TelemetryService) {}

    @MessagePattern('fleet/+/telemetry')
    async handleTelemetry(message: {topic: string; payload: Buffer | string}): Promise<void> {
        const fleetId = this.extractFleetId(message.topic);

        if(!fleetId) {
            this.logger.warn(`Received telemetry on invalid topic: ${message.topic}`);
            return;
        }

        const parsed = this.parsePayload(message.payload);
        if(!parsed) return;

        if (parsed.fleetId !== fleetId) {
          this.logger.warn(
            `Topic/payload mismatch — topic fleetId=${fleetId}, payload fleetId=${parsed.fleetId}`,
          );
          return;
        }

        const dto = plainToInstance(TelemetryPayloadDto, parsed);
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

    private extractFleetId(topic: string): string | null {
        const match = TOPIC_RE.exec(topic);
        return match ? match?.[1] : null;
    }

    private parsePayload(payload: Buffer | string): Record<string, unknown> | null {
        try {
            return JSON.parse(typeof payload === 'string' ? payload : payload.toString());
        } catch (error) {
            this.logger.error('Failed to parse MQTT payload', error);
            return null;
        }
    }
}