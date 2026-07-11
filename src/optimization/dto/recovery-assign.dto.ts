import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class RecoveryAssignDto {
  @IsString()
  @IsNotEmpty()
  readonly brokenFleetId!: string;

  @IsArray()
  @IsString({ each: true })
  readonly receivingFleetIds!: string[];

  @IsArray()
  @IsString({ each: true })
  readonly redistributedStopIds!: string[];
}