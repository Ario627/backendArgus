import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimToNull } from '../../common/dto/transforms.js';
import { FLEET_KODE_PATTERN, normalizeFleetKode } from '../fleet-kode.util.js';

const KAPASITAS_MAX_KG = 99999999.99;

export class CreateFleetDto {
  @Transform(normalizeFleetKode)
  @IsString()
  @Matches(FLEET_KODE_PATTERN)
  readonly kode!: string;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(16)
  readonly plat?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  readonly driverNama?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(32)
  readonly driverKontak?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(KAPASITAS_MAX_KG)
  readonly kapasitasKg?: number | null;

  @IsOptional()
  @IsBoolean()
  readonly aktif?: boolean;
}