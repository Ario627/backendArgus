import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  PARAMETER_KEYS,
  type ParameterKey,
  type ParameterSource,
} from '../common/constant/domain.constant.js';
import { ParameterKalibrasi } from '../database/entities/parameter-kalibrasi.entity.js';
import { parameterValueInvalidError } from './parameter.errors.js';
import { toParameterDto, type ParameterDto } from './parameter.mapper.js';
import type { UpdateParameterDto } from './dto/update-parameter.dto.js';

export interface ParameterReading {
  readonly nilai: number | null;
  readonly sumber: ParameterSource;
}

const NOTE_REQUIRED_MIN = 10;

const isParameterKey = (value: string): value is ParameterKey =>
  (PARAMETER_KEYS as readonly string[]).includes(value);

@Injectable()
export class ParameterService {
  constructor(
    @InjectRepository(ParameterKalibrasi)
    private readonly parameterRepository: Repository<ParameterKalibrasi>,
  ) {}

  async listAll(): Promise<readonly ParameterDto[]> {
    const rows = await this.parameterRepository.find();
    const byKey = new Map(rows.map((row) => [row.kunci, row]));
    return Object.freeze(
      PARAMETER_KEYS.map((kunci) => {
        const row = byKey.get(kunci);
        return toParameterDto({
          kunci,
          nilai: row?.nilai ?? null,
          satuan: row?.satuan ?? null,
          sumber: row?.sumber ?? 'belum_ada',
          catatan: row?.catatan ?? null,
          updatedBy: row?.updatedBy ?? null,
          updatedAt: row?.updatedAt ?? null,
        });
      }),
    );
  }

  async update(
    kunci: string,
    dto: UpdateParameterDto,
    actorId: string,
  ): Promise<ParameterDto> {
    if (!isParameterKey(kunci)) {
      throw parameterValueInvalidError([
        { code: 'unknownKey', field: kunci },
      ]);
    }
    const nilai = dto.nilai ?? null;
    if (dto.sumber === 'belum_ada' && nilai !== null) {
      throw parameterValueInvalidError([
        { code: 'valueNotAllowed', field: 'nilai' },
      ]);
    }
    if (dto.sumber !== 'belum_ada' && nilai === null) {
      throw parameterValueInvalidError([
        { code: 'valueRequired', field: 'nilai' },
      ]);
    }
    const catatan = dto.catatan ?? null;
    if (
      dto.sumber === 'manual_admin' &&
      (catatan === null || catatan.length < NOTE_REQUIRED_MIN)
    ) {
      throw parameterValueInvalidError([
        { code: 'noteRequired', field: 'catatan' },
      ]);
    }
    await this.parameterRepository.upsert(
      {
        kunci,
        nilai,
        satuan: dto.satuan ?? null,
        sumber: dto.sumber,
        catatan,
        updatedBy: actorId,
        updatedAt: new Date(),
      },
      { conflictPaths: ['kunci'], skipUpdateIfNoValuesChanged: false },
    );
    const saved = await this.parameterRepository.findOneOrFail({
      where: { kunci },
    });
    return toParameterDto({
      kunci,
      nilai: saved.nilai,
      satuan: saved.satuan,
      sumber: saved.sumber,
      catatan: saved.catatan,
      updatedBy: saved.updatedBy,
      updatedAt: saved.updatedAt,
    });
  }

  async getMany(
    keys: readonly ParameterKey[],
  ): Promise<ReadonlyMap<ParameterKey, ParameterReading>> {
    const rows = await this.parameterRepository.find({
      where: { kunci: In([...keys]) },
    });
    const readings = new Map<ParameterKey, ParameterReading>();
    for (const row of rows) {
      readings.set(row.kunci as ParameterKey, {
        nilai: row.nilai,
        sumber: row.sumber,
      });
    }
    return readings;
  }

  async getValue(key: ParameterKey): Promise<ParameterReading | null> {
    const readings = await this.getMany([key]);
    return readings.get(key) ?? null;
  }
}
