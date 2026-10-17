import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  IsNull,
  Not,
  QueryFailedError,
  Repository,
  type FindOptionsWhere,
} from 'typeorm';
import { DEFAULT_PAGE_SIZE } from '../common/dto/list-query.dto.js';
import type { ApiErrorDetail, PaginatedItems } from '../common/types.js';
import type { AppConfiguration } from '../config/configuration.js';
import { Device } from '../database/entities/device.entity.js';
import { Fleet } from '../database/entities/fleet.entity.js';
import { Sppg } from '../database/entities/sppg.entity.js';
import { generateId } from '../common/utils/id.util.js';
import { fleetNotFoundError } from '../fleet/fleet.errors.js';
import { sppgNotFoundError } from '../sppg/sppg.errors.js';
import {
  deviceNotFoundError,
  deviceRevokedError,
  deviceTargetInvalidError,
  deviceUsernameConflictError,
} from './device.errors.js';
import {
  generateMqttPassword,
  generateMqttUsername,
  mosquittoPasswordHash,
} from './device-credential.util.js';
import {
  decryptDeviceSecret,
  encryptDeviceSecret,
  generateDeviceSecret,
  parseDeviceEncKey,
} from './device-secret.util.js';
import type { CreateDeviceDto } from './dto/create-device.dto.js';
import type { DeviceListQueryDto } from './dto/device-list-query.dto.js';
import {
  toDeviceDto,
  type DeviceDto,
  type DeviceProvisioningDto,
} from './device.mapper.js';

const UNIQUE_VIOLATION = '23505';
const MAX_USERNAME_ATTEMPTS = 5;

export interface DeviceCreated {
  readonly device: DeviceDto;
  readonly provisioning: DeviceProvisioningDto;
}

interface DeviceTarget {
  readonly fleetId: string | null;
  readonly sppgId: string | null;
}

const readConstraint = (error: unknown): string | null => {
  if (!(error instanceof QueryFailedError)) return null;
  const driverError = error.driverError as {
    code?: string;
    constraint?: string;
  };
  return driverError.code === UNIQUE_VIOLATION
    ? (driverError.constraint ?? '')
    : null;
};

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);
  private readonly secretEncKey: Buffer;

  constructor(
    configService: ConfigService,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(Fleet)
    private readonly fleetRepository: Repository<Fleet>,
    @InjectRepository(Sppg)
    private readonly sppgRepository: Repository<Sppg>,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.secretEncKey = parseDeviceEncKey(config.device.secretEncKey);
  }

  private async resolveTarget(dto: CreateDeviceDto): Promise<DeviceTarget> {
    const details: ApiErrorDetail[] = [];
    if (dto.tipe === 'tracker') {
      if (dto.fleetId === undefined) {
        details.push({ code: 'fleetRequired', field: 'fleetId' });
      }
      if (dto.sppgId !== undefined) {
        details.push({ code: 'sppgForbidden', field: 'sppgId' });
      }
      if (details.length > 0) throw deviceTargetInvalidError(details);
      const fleetId = dto.fleetId ?? '';
      const fleet = await this.fleetRepository.findOne({
        where: { id: fleetId },
      });
      if (fleet === null) throw fleetNotFoundError();
      return { fleetId, sppgId: null };
    }

    if (dto.sppgId === undefined) {
      details.push({ code: 'sppgRequired', field: 'sppgId' });
    }
    if (dto.fleetId !== undefined) {
      details.push({ code: 'fleetForbidden', field: 'fleetId' });
    }
    if (details.length > 0) throw deviceTargetInvalidError(details);
    const sppgId = dto.sppgId ?? '';
    const sppg = await this.sppgRepository.findOne({ where: { id: sppgId } });
    if (sppg === null) throw sppgNotFoundError();
    return { fleetId: null, sppgId };
  }

  private async insertWithFreshUsername(device: Device): Promise<Device> {
    for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt += 1) {
      device.mqttUsername = generateMqttUsername();
      try {
        return await this.deviceRepository.save(device);
      } catch (error) {
        const constraint = readConstraint(error);
        if (constraint === 'device_mqtt_username_key') continue;
        throw error;
      }
    }
    throw deviceUsernameConflictError();
  }

  private async requireDevice(id: string): Promise<Device> {
    const device = await this.deviceRepository.findOne({ where: { id } });
    if (device === null) throw deviceNotFoundError();
    return device;
  }

  private provisioningOf(
    device: Device,
    mqttPassword: string,
    deviceSecret: string | null,
  ): DeviceProvisioningDto {
    return Object.freeze({
      mqttUsername: device.mqttUsername,
      mqttPassword,
      deviceSecret,
    });
  }

  async create(dto: CreateDeviceDto): Promise<DeviceCreated> {
    const target = await this.resolveTarget(dto);
    const mqttPassword = generateMqttPassword();
    const deviceSecret =
      dto.tipe === 'timbangan' ? generateDeviceSecret() : null;
    const device = this.deviceRepository.create({
      id: generateId(),
      tipe: dto.tipe,
      fleetId: target.fleetId,
      sppgId: target.sppgId,
      secretEnc:
        deviceSecret === null
          ? null
          : encryptDeviceSecret(deviceSecret, this.secretEncKey),
      mqttUsername: generateMqttUsername(),
      mqttPasswordHash: mosquittoPasswordHash(mqttPassword),
      firmware: dto.firmware ?? null,
    });
    const saved = await this.insertWithFreshUsername(device);
    return {
      device: toDeviceDto(saved),
      provisioning: this.provisioningOf(saved, mqttPassword, deviceSecret),
    };
  }

  async list(query: DeviceListQueryDto): Promise<PaginatedItems<DeviceDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const where: FindOptionsWhere<Device> = {};
    if (query.tipe !== undefined) where.tipe = query.tipe;
    if (query.sppgId !== undefined) where.sppgId = query.sppgId;
    if (query.fleetId !== undefined) where.fleetId = query.fleetId;
    if (query.revoked !== undefined) {
      where.revokedAt = query.revoked ? Not(IsNull()) : IsNull();
    }
    const [rows, total] = await this.deviceRepository.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'ASC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    return {
      items: rows.map(toDeviceDto),
      nextCursor: null,
      total,
    };
  }

  async getDetail(id: string): Promise<DeviceDto> {
    return toDeviceDto(await this.requireDevice(id));
  }

  async revoke(
    id: string,
  ): Promise<{ device: DeviceDto; alreadyRevoked: boolean }> {
    const device = await this.requireDevice(id);
    if (device.revokedAt !== null) {
      return { device: toDeviceDto(device), alreadyRevoked: true };
    }
    device.revokedAt = new Date();
    const saved = await this.deviceRepository.save(device);
    if (saved.tipe === 'tracker' && saved.fleetId !== null) {
      await this.deviceRepository.manager.query(
        `UPDATE fleet
            SET device_revoked_at = $2
          WHERE id = $1
            AND device_revoked_at IS NULL`,
        [saved.fleetId, saved.revokedAt],
      );
    }
    this.logger.log(`perangkat dicabut id=${saved.id} tipe=${saved.tipe}`);
    return { device: toDeviceDto(saved), alreadyRevoked: false };
  }

  async rotateSecret(id: string): Promise<DeviceCreated> {
    const device = await this.requireDevice(id);
    if (device.revokedAt !== null) throw deviceRevokedError();
    const mqttPassword = generateMqttPassword();
    const deviceSecret =
      device.tipe === 'timbangan' ? generateDeviceSecret() : null;
    device.mqttPasswordHash = mosquittoPasswordHash(mqttPassword);
    if (deviceSecret !== null) {
      device.secretEnc = encryptDeviceSecret(deviceSecret, this.secretEncKey);
    }
    const saved = await this.deviceRepository.save(device);
    return {
      device: toDeviceDto(saved),
      provisioning: this.provisioningOf(saved, mqttPassword, deviceSecret),
    };
  }

  async resolveDeviceSecret(deviceId: string): Promise<string | null> {
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId },
    });
    if (device?.secretEnc == null) return null;
    return decryptDeviceSecret(device.secretEnc, this.secretEncKey);
  }
}