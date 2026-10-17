import { IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import {
  APPENDABLE_LEDGER_EVENT_TYPES,
  type AppendableLedgerEventType,
  type TransferSide,
} from '../ledger-permission.util.js';

const HEX64 = /^[0-9a-f]{64}$/;
const TRANSFER_SIDES = Object.freeze(['KIRIM', 'TERIMA'] as const);

export class AppendEventDto {
  @IsUUID('7')
  readonly clientEventId!: string;

  @IsIn(APPENDABLE_LEDGER_EVENT_TYPES)
  readonly tipe!: AppendableLedgerEventType;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(500)
  readonly weightKg?: number;

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

  @IsOptional()
  @IsIn(TRANSFER_SIDES)
  readonly sisi?: TransferSide;

  @IsOptional()
  @IsInt()
  @Min(1)
  readonly refEventId?: number;
}