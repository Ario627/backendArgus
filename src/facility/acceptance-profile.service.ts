import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { DEFAULT_PAGE_SIZE, type ListQueryDto } from '../common/dto/list-query.dto.js';
import { forbiddenActionError } from '../common/errors/http.errors.js';
import type { AuthenticatedUser, PaginatedItems } from '../common/types.js';
import { generateId } from '../common/utils/id.util.js';
import { AcceptanceProfile } from '../database/entities/acceptance-profile.entity.js';
import { Facility } from '../database/entities/facility.entity.js';
import { facilityNotFoundError, profileInvalidError, profileNotFoundError } from './facility.errors.js';
import { toProfileDto, type ProfileDto } from './facility.mapper.js';
import { parseAcceptanceProfile } from './acceptance-profile.validator.js';

@Injectable()
export class AcceptanceProfileService {
  constructor(
    @InjectRepository(Facility) private readonly facilityRepository: Repository<Facility>,
    @InjectRepository(AcceptanceProfile)
    private readonly profileRepository: Repository<AcceptanceProfile>,
    private readonly dataSource: DataSource,
  ) {}

  async getActive(facilityId: string): Promise<ProfileDto> {
    await this.ensureFacilityExists(facilityId);
    const profile = await this.profileRepository.findOne({
      where: { fasilitasId: facilityId, berlakuSampai: IsNull() },
    });
    if (profile === null) throw profileNotFoundError();
    return toProfileDto(profile);
  }

  async listVersions(facilityId: string, query: ListQueryDto): Promise<PaginatedItems<ProfileDto>> {
    await this.ensureFacilityExists(facilityId);
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const [rows, total] = await this.profileRepository.findAndCount({
      where: { fasilitasId: facilityId },
      order: { versi: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    return { items: rows.map(toProfileDto), nextCursor: null, total };
  }

  async createVersion(facilityId: string, body: unknown, actor: AuthenticatedUser): Promise<ProfileDto> {
    if (actor.role === 'facility' && actor.facilityId !== facilityId) {
      throw forbiddenActionError();
    }
    const parsed = parseAcceptanceProfile(body);
    if (!parsed.ok) throw profileInvalidError(parsed.violations);

    return this.dataSource.transaction(async (manager) => {
      const facility = await manager.findOne(Facility, {
        where: { id: facilityId },
        lock: { mode: 'pessimistic_write' },
      });
      if (facility === null) throw facilityNotFoundError();

      const effectiveAt = new Date();
      const active = await manager.findOne(AcceptanceProfile, {
        where: { fasilitasId: facilityId, berlakuSampai: IsNull() },
      });
      if (active !== null) {
        await manager.update(AcceptanceProfile, { id: active.id }, { berlakuSampai: effectiveAt });
      }

      const latest = await manager.findOne(AcceptanceProfile, {
        where: { fasilitasId: facilityId },
        order: { versi: 'DESC' },
      });
      const nextVersion = (latest?.versi ?? 0) + 1;

      const entity = manager.create(AcceptanceProfile, {
        id: generateId(),
        fasilitasId: facilityId,
        versi: nextVersion,
        aturan: {
          ...parsed.profile,
          acceptsFractions: [...parsed.profile.acceptsFractions],
          moisture: { ...parsed.profile.moisture },
          contaminant: { ...parsed.profile.contaminant },
        },
        berlakuDari: effectiveAt,
        berlakuSampai: null,
        dibuatOleh: actor.id,
        createdAt: effectiveAt,
      });
      return toProfileDto(await manager.save(entity));
    });
  }

  private async ensureFacilityExists(facilityId: string): Promise<void> {
    const exists = await this.facilityRepository.exists({ where: { id: facilityId } });
    if (!exists) throw facilityNotFoundError();
  }
}