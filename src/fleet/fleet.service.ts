import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository, type FindOptionsWhere } from 'typeorm';
import { forbiddenActionError } from '../common/errors/http.errors.js';
import type { AuthenticatedUser, PaginatedItems } from '../common/types.js';
import { DEFAULT_PAGE_SIZE } from '../common/dto/list-query.dto.js';
import { generateId } from '../common/utils/id.util.js';
import { Fleet } from '../database/entities/fleet.entity.js';
import { fleetKodeConflictError, fleetNotFoundError } from './fleet.errors.js';
import type { CreateFleetDto } from './dto/create-fleet.dto.js';
import type { FleetListQueryDto } from './dto/fleet-list-query.dto.js';
import type { UpdateFleetDto } from './dto/update-fleet.dto.js';
import { toFleetDto, type FleetDto } from './fleet.mapper.js';

const UNIQUE_VIOLATION = '23505';

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof QueryFailedError &&
  (error.driverError as { code?: string }).code === UNIQUE_VIOLATION;

@Injectable()
export class FleetService {
  constructor(
    @InjectRepository(Fleet)
    private readonly fleetRepository: Repository<Fleet>,
  ) {}

  private assertVisible(fleet: Fleet, actor: AuthenticatedUser): void {
    if (actor.role === 'driver' && actor.fleetId !== fleet.id) {
      throw forbiddenActionError();
    }
  }

  private async saveOrConflict(fleet: Fleet): Promise<FleetDto> {
    try {
      return toFleetDto(await this.fleetRepository.save(fleet), Date.now());
    } catch (error) {
      if (isUniqueViolation(error)) throw fleetKodeConflictError();
      throw error;
    }
  }

  async list(
    query: FleetListQueryDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedItems<FleetDto>> {
    if (actor.role === 'driver' && actor.fleetId === null) {
      return { items: [], nextCursor: null, total: 0 };
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const where: FindOptionsWhere<Fleet> = {};
    if (query.aktif !== undefined) where.aktif = query.aktif;
    if (query.status !== undefined) where.statusOperasional = query.status;
    if (actor.role === 'driver') where.id = actor.fleetId ?? undefined;
    const [rows, total] = await this.fleetRepository.findAndCount({
      where,
      order: { kode: 'ASC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    const nowMs = Date.now();
    return {
      items: rows.map((row) => toFleetDto(row, nowMs)),
      nextCursor: null,
      total,
    };
  }

  async getDetail(id: string, actor: AuthenticatedUser): Promise<FleetDto> {
    const fleet = await this.fleetRepository.findOne({ where: { id } });
    if (fleet === null) throw fleetNotFoundError();
    this.assertVisible(fleet, actor);
    return toFleetDto(fleet, Date.now());
  }

  async create(dto: CreateFleetDto): Promise<FleetDto> {
    const fleet = this.fleetRepository.create({
      id: generateId(),
      kode: dto.kode,
      plat: dto.plat ?? null,
      driverNama: dto.driverNama ?? null,
      driverKontak: dto.driverKontak ?? null,
      kapasitasKg: dto.kapasitasKg ?? null,
      aktif: dto.aktif ?? true,
    });
    return this.saveOrConflict(fleet);
  }

  async update(id: string, dto: UpdateFleetDto): Promise<FleetDto> {
    const fleet = await this.fleetRepository.findOne({ where: { id } });
    if (fleet === null) throw fleetNotFoundError();
    if (dto.kode !== undefined) fleet.kode = dto.kode;
    if (dto.plat !== undefined) fleet.plat = dto.plat;
    if (dto.driverNama !== undefined) fleet.driverNama = dto.driverNama;
    if (dto.driverKontak !== undefined) fleet.driverKontak = dto.driverKontak;
    if (dto.kapasitasKg !== undefined) fleet.kapasitasKg = dto.kapasitasKg;
    if (dto.aktif !== undefined) fleet.aktif = dto.aktif;
    return this.saveOrConflict(fleet);
  }
}