import { IsNumber, IsUUID, Matches, Max, Min } from 'class-validator';
import { BATCH_WEIGHT_LIMITS } from '../../common/constant/domain.constant.js';
import {
  SCALE_SIGNATURE_PATTERN,
  SCALE_TIME_PATTERN,
} from '../scale-payload.util.js';

export class ScaleWeightDto {
  @IsUUID()
  readonly deviceId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(BATCH_WEIGHT_LIMITS.maxKg)
  readonly weightKg!: number;

  @Matches(SCALE_TIME_PATTERN)
  readonly occurredAt!: string;

  @Matches(SCALE_SIGNATURE_PATTERN)
  readonly sig!: string;
}