import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { DEFAULT_PAGE_SIZE } from '../common/dto/list-query.dto.js';
import { forbiddenActionError } from '../common/errors/http.errors.js';
import type { AuthenticatedUser, PaginatedItems } from '../common/types.js';
import { generateId, generatePublicSlug } from '../common/utils/id.util.js';
import { DistributionPoint } from '../database/entities/distribution-point.entity.js';
import { Sppg } from '../database/entities/sppg.entity.js';
import type { CreatePointDto } from './dto/create-point.dto.js';
import type { CreateSppgDto } from './dto/create-sppg.dto.js';
import type { SppgListQueryDto } from './dto/list-query.dto.js';
import type { UpdatePointDto } from './dto/update-point.dto.js';
import type { UpdateSppgDto } from './dto/update-sppg.dto.js';
import {
  toPointDto,
  toSppgDto,
  type PointDto,
  type SppgDetailDto,
  type SppgDto,
} from './sppg.mapper.js';
import { sppgNotFoundError, sppgPointNotFoundError } from './sppg.errors.js';

const MAX_SLUG_ATTEMPTS = 3;

const isPublicSlugCollision = (error: unknown): boolean => {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = (error as { driverError?: unknown }).driverError;
  if (typeof driverError !== 'object' || driverError === null) return false;
  const record = driverError as Record<string, unknown>;
  return (
    record.code === '23505' && record.constraint === 'sppg_public_slug_key'
  );
};

const applySppgPatch = (sppg: Sppg, dto: UpdateSppgDto): void => {
  if (dto.nama !== undefined) sppg.nama = dto.nama;
  if (dto.alamat !== undefined) sppg.alamat = dto.alamat;
  if (dto.lat !== undefined) sppg.lat = dto.lat;
  if (dto.lng !== undefined) sppg.lng = dto.lng;
  if (dto.porsiPerHari !== undefined) sppg.porsiPerHari = dto.porsiPerHari;
  if (dto.mitra !== undefined) sppg.mitra = dto.mitra;
  if (dto.kapasitasOlahKg !== undefined)
    sppg.kapasitasOlahKg = dto.kapasitasOlahKg;
  if (dto.aktif !== undefined) sppg.aktif = dto.aktif;
};

const applyPointPatch = (
  point: DistributionPoint,
  dto: UpdatePointDto,
): void => {
  if (dto.nama !== undefined) point.nama = dto.nama;
  if (dto.jenis !== undefined) point.jenis = dto.jenis;
  if (dto.lat !== undefined) point.lat = dto.lat;
  if (dto.lng !== undefined) point.lng = dto.lng;
  if (dto.aktif !== undefined) point.aktif = dto.aktif;
};

@Injectable()
export class SppgService {
  constructor(
    @InjectRepository(Sppg) private readonly sppgRepository: Repository<Sppg>,
    @InjectRepository(DistributionPoint)
    private readonly pointRepository: Repository<DistributionPoint>,
  ) {}

  async list(query: SppgListQueryDto): Promise<PaginatedItems<SppgDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const [rows, total] = await this.sppgRepository.findAndCount({
      where: query.aktif === undefined ? {} : { aktif: query.aktif },
      order: { nama: 'ASC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    return { items: rows.map(toSppgDto), nextCursor: null, total };
  }

  async getDetail(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<SppgDetailDto> {
    const sppg = await this.findSppgOrFail(id);
    if (actor.role === 'sppg_staff' && actor.sppgId !== sppg.id) {
      throw forbiddenActionError();
    }
    const points = await this.pointRepository.find({
      where: { sppgId: id },
      order: { nama: 'ASC' },
    });
    return { ...toSppgDto(sppg), points: points.map(toPointDto) };
  }

  async create(dto: CreateSppgDto): Promise<SppgDto> {
    const entity = this.sppgRepository.create({
      id: generateId(),
      publicSlug: generatePublicSlug(),
      nama: dto.nama,
      alamat: dto.alamat ?? null,
      lat: dto.lat,
      lng: dto.lng,
      porsiPerHari: dto.porsiPerHari,
      mitra: dto.mitra ?? null,
      kapasitasOlahKg: dto.kapasitasOlahKg ?? null,
      aktif: true,
      isDemo: false,
      createdAt: new Date(),
    });
    await this.insertWithUniqueSlug(entity);
    return toSppgDto(entity);
  }

  async update(id: string, dto: UpdateSppgDto): Promise<SppgDto> {
    const sppg = await this.findSppgOrFail(id);
    applySppgPatch(sppg, dto);
    return toSppgDto(await this.sppgRepository.save(sppg));
  }

  async createPoint(sppgId: string, dto: CreatePointDto): Promise<PointDto> {
    await this.findSppgOrFail(sppgId);
    const point = this.pointRepository.create({
      id: generateId(),
      sppgId,
      nama: dto.nama,
      jenis: dto.jenis,
      lat: dto.lat ?? null,
      lng: dto.lng ?? null,
      aktif: true,
      createdAt: new Date(),
    });
    return toPointDto(await this.pointRepository.save(point));
  }

  async updatePoint(
    sppgId: string,
    pointId: string,
    dto: UpdatePointDto,
  ): Promise<PointDto> {
    const point = await this.pointRepository.findOne({
      where: { id: pointId, sppgId },
    });
    if (point === null) throw sppgPointNotFoundError();
    applyPointPatch(point, dto);
    return toPointDto(await this.pointRepository.save(point));
  }

  private async findSppgOrFail(id: string): Promise<Sppg> {
    const sppg = await this.sppgRepository.findOne({ where: { id } });
    if (sppg === null) throw sppgNotFoundError();
    return sppg;
  }

  private async insertWithUniqueSlug(entity: Sppg): Promise<void> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        await this.sppgRepository.save(entity);
        return;
      } catch (error) {
        if (!isPublicSlugCollision(error) || attempt >= MAX_SLUG_ATTEMPTS - 1)
          throw error;
        entity.publicSlug = generatePublicSlug();
      }
    }
  }
}
