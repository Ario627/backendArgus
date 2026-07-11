import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RecoveryTriggerDto {
  @IsString()
  @IsNotEmpty()
  readonly brokenFleetId!: string;

  @IsBoolean()
  @IsOptional()
  readonly manual?: boolean;
}