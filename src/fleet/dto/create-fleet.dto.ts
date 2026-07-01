import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreateFleetDto {
  @IsString()
  @Matches(/^[A-Z0-9-]{3,12}$/)
  readonly plateNumber!: string;

  @IsString()
  @IsNotEmpty()
  readonly driverName!: string;

  @IsString()
  @IsOptional()
  readonly driverContact?: string;

  @IsNumber()
  @Min(0)
  readonly capacityKg!: number;
}
