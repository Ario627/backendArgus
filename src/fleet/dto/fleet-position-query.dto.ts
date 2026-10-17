import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_POSITION_MINUTES = 30;
export const MAX_POSITION_MINUTES = 240;

export class FleetPositionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_POSITION_MINUTES)
  readonly minutes?: number;
}