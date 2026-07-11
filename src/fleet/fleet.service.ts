import { InjectRepository } from '@nestjs/typeorm';
import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { IsNull, Repository } from 'typeorm';
import { FleetEntity } from 'src/database/entities/fleet.entity';
import { DeviceEntity, DeviceStatus } from 'src/database/entities/device.entity';
import { CreateFleetDto } from './dto/create-fleet.dto';
import { UpdateFleetDto } from './dto/update-fleet.dto';
import type { PaginatedResponse } from 'src/common/types';

const PG_UNIQUE_VIOLATION = '23505';

export interface FleetCsvRow {
  fleetId: string;
  plateNumber: string;
  driverName: string;
  driverContact: string;
  capacityKg: number;
  deviceId: string;
  statusHardware: string;
  operationalStatus: string;
}

@Injectable()
export class FleetService {
  private readonly logger = new Logger(FleetService.name);

  constructor(
    @InjectRepository(FleetEntity)
    private readonly repo: Repository<FleetEntity>,
    @InjectRepository(DeviceEntity)
    private readonly deviceRepo: Repository<DeviceEntity>,
  ) {}

  findAll(page = 1, limit = 20): Promise<PaginatedResponse<FleetEntity>> {
    return this.paginate(page, limit);
  }

  findOne(id: string): Promise<FleetEntity> {
    return this.findOrFail(id);
  }

  async create(dto: CreateFleetDto): Promise<FleetEntity> {
    try {
      return await this.repo.save(this.repo.create(dto));
    } catch (err) {
      throw this.toConflict(err);
    }
  }

  async update(id: string, dto: UpdateFleetDto): Promise<FleetEntity> {
    const fleet = await this.findOrFail(id);
    Object.assign(fleet, dto);
    try {
      return await this.repo.save(fleet);
    } catch (err) {
      throw this.toConflict(err);
    }
  }

  async softDelete(id: string): Promise<{ id: string }> {
    await this.findOrFail(id);
    await this.repo.update(id, { deletedAt: new Date() });
    return { id };
  }

  async revokeDevice(id: string): Promise<FleetEntity> {
    const fleet = await this.findOrFail(id);
    if (fleet.deviceRevokedAt)
      throw new ConflictException('Device already revoked');
    fleet.deviceRevokedAt = new Date();
    return this.repo.save(fleet);
  }

  private async findOrFail(id: string): Promise<FleetEntity> {
    const fleet = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!fleet) throw new NotFoundException(`Fleet ${id} not found`);
    return fleet;
  }

  private async paginate(
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<FleetEntity>> {
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
      return new ConflictException('plateNumber already exists');
    }
    this.logger.error(`Fleet save failed: ${(err as Error).message}`);
    return new ConflictException('Conflict');
  }

  async exportCsv(): Promise<FleetCsvRow[]> {
    const fleets = await this.repo.find({
      where: { deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    const devices = await this.deviceRepo.find({
      where: { status: DeviceStatus.ASSIGNED },
    });

    const deviceMap = new Map<string, string>();
    for (const d of devices) {
      if (d.fleetId) {
        deviceMap.set(d.fleetId, d.deviceId);
      }
    }

    return fleets.map((f) => ({
      fleetId: f.id,
      plateNumber: f.plateNumber,
      driverName: f.driverName,
      driverContact: f.driverContact ?? '',
      capacityKg: f.capacityKg,
      deviceId: deviceMap.get(f.id) ?? '',
      statusHardware: f.statusHardware,
      operationalStatus: f.operationalStatus,
    }));
  }
}
