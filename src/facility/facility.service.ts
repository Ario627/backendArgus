import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DEFAULT_PAGE_SIZE } from '../common/dto/list-query.dto.js';
import { forbiddenActionError } from '../common/errors/http.errors.js';
import type { AuthenticatedUser, PaginatedItems } from '../common/types.js';
import { generateId } from '../common/utils/id.util.js';
import { Facility } from '../database/entities/facility.entity.js';
import type { CreateFacilityDto } from './dto/create-facility.dto.js';
import type { FacilityListQueryDto } from './dto/list-query.dto.js';
import type { UpdateFacilityDto } from './dto/update-facility.dto.js';
import { facilityNotFoundError } from './facility.errors.js';
import { toFacilityDto, type FacilityDto } from './facility.mapper.js';

const FACILITY_GOVERNED_FIELDS: readonly (keyof UpdateFacilityDto)[] = ['tingkat', 'jenis', 'mitra', 'aktif'];

const findForbiddenSelfFields = (dto: UpdateFacilityDto): readonly string[] =>
  FACILITY_GOVERNED_FIELDS.filter((field) => dto[field] !== undefined);

const applyFacilityPatch = (facility: Facility, dto: UpdateFacilityDto): void => {
  if (dto.nama !== undefined) facility.nama = dto.nama;
  if (dto.tingkat !== undefined) facility.tingkat = dto.tingkat;
  if (dto.jenis !== undefined) facility.jenis = dto.jenis;
  if (dto.lat !== undefined) facility.lat = dto.lat;
  if (dto.lng !== undefined) facility.lng = dto.lng;
  if (dto.kapasitasKgHari !== undefined) facility.kapasitasKgHari = dto.kapasitasKgHari;
  if (dto.jamOperasi !== undefined) facility.jamOperasi = dto.jamOperasi;
  if (dto.mitra !== undefined) facility.mitra = dto.mitra;
  if (dto.aktif !== undefined) facility.aktif = dto.aktif;
};

@Injectable()
export class FacilityService {
  constructor(
    @InjectRepository(Facility) private readonly facilityRepository: Repository<Facility>,
  ) {}

  async list(query: FacilityListQueryDto): Promise<PaginatedItems<FacilityDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const [rows, total] = await this.facilityRepository.findAndCount({
      where: query.aktif === undefined ? {} : { aktif: query.aktif },
      order: { tingkat: 'ASC', nama: 'ASC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    return { items: rows.map(toFacilityDto), nextCursor: null, total };
  }

  async create(dto: CreateFacilityDto): Promise<FacilityDto> {
    const facility = this.facilityRepository.create({
      id: generateId(),
      nama: dto.nama,
      tingkat: dto.tingkat,
      jenis: dto.jenis,
      lat: dto.lat,
      lng: dto.lng,
      kapasitasKgHari: dto.kapasitasKgHari ?? null,
      jamOperasi: dto.jamOperasi ?? null,
      mitra: dto.mitra ?? false,
      aktif: dto.aktif ?? true,
      isDemo: false,
      createdAt: new Date(),
    });
    return toFacilityDto(await this.facilityRepository.save(facility));
  }

  async update(id: string, dto: UpdateFacilityDto, actor: AuthenticatedUser): Promise<FacilityDto> {
    if (actor.role === 'facility') {
      if (actor.facilityId !== id) throw forbiddenActionError();
      const forbiddenFields = findForbiddenSelfFields(dto);
      if (forbiddenFields.length > 0) {
        throw forbiddenActionError(
          forbiddenFields.map((field) => ({ code: 'FIELD_FORBIDDEN', field })),
        );
      }
    }
    const facility = await this.facilityRepository.findOne({ where: { id } });
    if (facility === null) throw facilityNotFoundError();
    applyFacilityPatch(facility, dto);
    return toFacilityDto(await this.facilityRepository.save(facility));
  }
}