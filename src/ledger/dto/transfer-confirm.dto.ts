import { IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';

const HEX64 = /^[0-9a-f]{64}$/;

export class TransferConfirmDto {
  @IsUUID('7')
  readonly clientEventId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  @Max(500)
  readonly weightKg!: number;

  @IsISO8601()
  readonly occurredAt!: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  readonly lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  readonly lng?: number;

  @IsOptional()
  @IsString()
  @Length(64, 64)
  @Matches(HEX64)
  readonly photoHash?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  readonly note?: string;
}