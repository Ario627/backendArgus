import { InjectRepository } from '@nestjs/typeorm';
import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { IsNull, Repository } from 'typeorm';
import { randomBytes, randomUUID } from 'crypto';
import { DeviceEntity, DeviceStatus } from 'src/database/entities/device.entity';
import {
  ProvisioningTokenEntity,
  TokenStatus,
} from 'src/database/entities/provisioning-token.entity';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { GenerateTokenDto } from './dto/provision.dto';
import { AssignDeviceDto } from './dto/assign-device.dto';

const TOKEN_TTL_HOURS = 24;
const PG_UNIQUE_VIOLATION = '23505';

export interface ProvisionResult {
  deviceId: string;
  fleetId: string;
}

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  constructor(
    @InjectRepository(DeviceEntity)
    private readonly deviceRepo: Repository<DeviceEntity>,
    @InjectRepository(ProvisioningTokenEntity)
    private readonly tokenRepo: Repository<ProvisioningTokenEntity>,
  ) {}

  findAll(status?: DeviceStatus): Promise<DeviceEntity[]> {
    const where = status ? { status } : {};
    return this.deviceRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  findByDeviceId(deviceId: string): Promise<DeviceEntity | null> {
    return this.deviceRepo.findOne({ where: { deviceId } });
  }

  async register(dto: RegisterDeviceDto): Promise<DeviceEntity> {
    const secret = dto.secret ?? randomBytes(24).toString('hex');
    const entity = this.deviceRepo.create({
      deviceId: dto.deviceId,
      secret,
      fleetId: null,
      status: DeviceStatus.UNASSIGNED,
    });
    try {
      return await this.deviceRepo.save(entity);
    } catch (err) {
      if ((err as { code?: string }).code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException(
          `Device ${dto.deviceId} already registered`,
        );
      }
      throw err;
    }
  }

  async assignToFleet(
    fleetId: string,
    dto: AssignDeviceDto,
  ): Promise<DeviceEntity> {
    const device = await this.deviceRepo.findOne({
      where: { deviceId: dto.deviceId },
    });
    if (!device) {
      throw new NotFoundException(
        `Device ${dto.deviceId} not found. Register it first.`,
      );
    }
    if (device.status === DeviceStatus.REVOKED) {
      throw new BadRequestException('Device is revoked');
    }
    if (device.fleetId === fleetId) return device;

    device.fleetId = fleetId;
    device.status = DeviceStatus.ASSIGNED;
    return this.deviceRepo.save(device);
  }

  async revoke(deviceId: string): Promise<DeviceEntity> {
    const device = await this.deviceRepo.findOne({
      where: { deviceId },
    });
    if (!device) {
      throw new NotFoundException(`Device ${deviceId} not found`);
    }
    device.status = DeviceStatus.REVOKED;
    device.fleetId = null;
    return this.deviceRepo.save(device);
  }

  async getFleetIdByDeviceId(deviceId: string): Promise<string | null> {
    const device = await this.deviceRepo.findOne({
      where: { deviceId, status: DeviceStatus.ASSIGNED },
    });
    if (!device || !device.fleetId) return null;
    return device.fleetId;
  }

  async generateProvisioningToken(
    dto: GenerateTokenDto,
  ): Promise<ProvisioningTokenEntity> {
    const device = await this.deviceRepo.findOne({
      where: { deviceId: dto.deviceId },
    });
    if (!device) {
      throw new NotFoundException(
        `Device ${dto.deviceId} not found. Register it first.`,
      );
    }

    const token = `ptk_${randomUUID().replace(/-/g, '')}${randomBytes(16).toString('hex')}`;
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

    const entity = this.tokenRepo.create({
      token,
      deviceId: dto.deviceId,
      fleetId: dto.fleetId,
      status: TokenStatus.ACTIVE,
      expiresAt,
    });

    return this.tokenRepo.save(entity);
  }

  async provisionWithToken(
    token: string,
  ): Promise<ProvisionResult> {
    const tokenEntity = await this.tokenRepo.findOne({
      where: { token },
    });

    if (!tokenEntity) {
      throw new BadRequestException('Invalid provisioning token');
    }

    if (tokenEntity.status !== TokenStatus.ACTIVE) {
      throw new BadRequestException(
        `Token is ${tokenEntity.status}, cannot be used`,
      );
    }

    if (tokenEntity.expiresAt < new Date()) {
      await this.tokenRepo.update(tokenEntity.id, {
        status: TokenStatus.EXPIRED,
      });
      throw new BadRequestException('Token has expired');
    }

    if (tokenEntity.usedAt) {
      throw new BadRequestException('Token already used');
    }

    if (tokenEntity.deviceId && tokenEntity.fleetId) {
      await this.assignToFleet(tokenEntity.fleetId, {
        deviceId: tokenEntity.deviceId,
      });
    }

    await this.tokenRepo.update(tokenEntity.id, {
      status: TokenStatus.EXPIRED,
      usedAt: new Date(),
    });

    this.logger.log(
      `Device ${tokenEntity.deviceId} provisioned to fleet ${tokenEntity.fleetId}`,
    );

    return {
      deviceId: tokenEntity.deviceId!,
      fleetId: tokenEntity.fleetId!,
    };
  }

  findUnassigned(): Promise<DeviceEntity[]> {
    return this.deviceRepo.find({
      where: { fleetId: IsNull(), status: DeviceStatus.UNASSIGNED },
      order: { createdAt: 'DESC' },
    });
  }
}