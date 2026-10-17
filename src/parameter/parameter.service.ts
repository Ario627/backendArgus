import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { ParameterKey, ParameterSource } from '../common/constant/domain.constant.js';
import { ParameterKalibrasi } from '../database/entities/parameter-kalibrasi.entity.js';

export interface ParameterReading {
  readonly nilai: number | null;
  readonly sumber: ParameterSource;
}

@Injectable()
export class ParameterService {
  constructor(
    @InjectRepository(ParameterKalibrasi)
    private readonly parameterRepository: Repository<ParameterKalibrasi>,
  ) {}

  async getMany(
    keys: readonly ParameterKey[],
  ): Promise<ReadonlyMap<ParameterKey, ParameterReading>> {
    const rows = await this.parameterRepository.find({ where: { kunci: In([...keys]) } });
    const readings = new Map<ParameterKey, ParameterReading>();
    for (const row of rows) {
      readings.set(row.kunci as ParameterKey, { nilai: row.nilai, sumber: row.sumber });
    }
    return readings;
  }

  async getValue(key: ParameterKey): Promise<ParameterReading | null> {
    const readings = await this.getMany([key]);
    return readings.get(key) ?? null;
  }
}