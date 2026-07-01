import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { DestinationType } from 'src/common/constant/destination.constant';

export class CreateDestinationDto {
  @IsNotEmpty()
  readonly name!: string;

  @IsEnum(DestinationType)
  readonly type!: DestinationType;

  @IsNumber()
  @IsLatitude()
  readonly latitude!: number;

  @IsNumber()
  @IsLongitude()
  readonly longitude!: number;

  @IsNumber()
  @Min(0)
  readonly capacityKg!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  readonly priority?: number;
}
