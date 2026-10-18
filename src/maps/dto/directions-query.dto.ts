import { IsString, Matches } from 'class-validator';

const COORDINATE_PAIR = /^-?\d{1,3}(?:\.\d+)?,-?\d{1,3}(?:\.\d+)?$/;

export class DirectionsQueryDto {
  @IsString()
  @Matches(COORDINATE_PAIR, { message: 'from harus berformat lat,lng' })
  readonly from!: string;

  @IsString()
  @Matches(COORDINATE_PAIR, { message: 'to harus berformat lat,lng' })
  readonly to!: string;
}
