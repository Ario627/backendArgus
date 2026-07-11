import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull } from "typeorm";
import { Injectable, ConflictException, Logger, NotFoundException } from "@nestjs/common";
import { DestinationEntity } from "src/database/entities/destination.entity";
import { DestinationType } from "src/common/constant/destination.constant";
import { CreateDestinationDto } from "./dto/create-destination.dto";
import { UpdateDestinationDto } from "./dto/update-destination.dto";
import type { PaginatedResponse } from "src/common/types";

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class DestinationService {
  private readonly logger = new Logger(DestinationService.name);

  constructor(
    @InjectRepository(DestinationEntity)
    private readonly repo: Repository<DestinationEntity>,
  ) {}

  findAll(page = 1, limit = 20): Promise<PaginatedResponse<DestinationEntity>> {
    return this.paginate(page, limit);
  }

  findOne(id: string): Promise<DestinationEntity> {
    return this.findOrFail(id);
  }

  async create(dto: CreateDestinationDto): Promise<DestinationEntity> {
    try {
      return await this.repo.save(this.repo.create(dto));
    } catch (err) {
      throw this.toConflict(err);
    }
  }

  async update(
    id: string,
    dto: UpdateDestinationDto,
  ): Promise<DestinationEntity> {
    const dest = await this.findOrFail(id);
    Object.assign(dest, dto);
    try {
      return await this.repo.save(dest);
    } catch (err) {
      throw this.toConflict(err);
    }
  }

  async upsertFromTelemetry(payload: Record<string, unknown>): Promise<DestinationEntity> {
    const destId = payload.destinationId as string;
    if (!destId) throw new NotFoundException('Missing destinationId in telemetry payload');

    let dest = await this.repo.findOne({ where: { id: destId, deletedAt: IsNull() } });

    if (dest) {
      if (typeof payload.currentLoadKg === 'number') {
        dest.capacityKg = dest.capacityKg || ((payload.capacityKg as number) ?? 10000);
      }
      dest.lowVolumeFlag = (payload.lowVolumeFlag as boolean) ?? dest.lowVolumeFlag;
    } else {
      dest = this.repo.create({
        id: destId,
        name: (payload.name as string) ?? destId,
        type: (payload.type as string ?? 'TPS') as DestinationEntity['type'],
        latitude: (payload.latitude as number) ?? 0,
        longitude: (payload.longitude as number) ?? 0,
        capacityKg: (payload.capacityKg as number) ?? 10000,
        priority: 5,
        lowVolumeFlag: false,
      });
    }

    return this.repo.save(dest);
  }

  async softDelete(id: string): Promise<{ id: string }> {
    await this.findOrFail(id);
    await this.repo.update(id, { deletedAt: new Date() });
    return { id };
  }

  private async findOrFail(id: string): Promise<DestinationEntity> {
    const dest = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!dest) throw new NotFoundException(`Destination ${id} not found`);
    return dest;
  }

  private async paginate(
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<DestinationEntity>> {
    const [data, total] = await this.repo.findAndCount({
      where: { deletedAt: IsNull() },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, total, page, limit, hasNext: page * limit < total };
  }

  private toConflict(err: unknown): ConflictException {
    if (
      err instanceof Error &&
      (err as { code?: string }).code === PG_UNIQUE_VIOLATION
    ) {
      return new ConflictException('Destination name already exists');
    }
    this.logger.error(`Destination save failed: ${(err as Error).message}`);
    return new ConflictException('Conflict');
  }
}