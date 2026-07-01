import { PartialType, OmitType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateFleetDto } from './create-fleet.dto';

export class UpdateFleetDto extends PartialType(
  OmitType(CreateFleetDto, ['plateNumber'] as const),
) {
  @IsString()
  @IsOptional()
  readonly plateNumber?: string;
}