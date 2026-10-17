import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import {
  MENU_COMPONENTS,
  type MenuComponent,
} from '../../common/constant/domain.constant.js';
import { trim } from '../../common/dto/transforms.js';

const BIAYA_MAX_RP = 99999999.99;

export class CreateMenuItemDto {
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  readonly nama!: string;

  @IsIn(MENU_COMPONENTS)
  readonly komponen!: MenuComponent;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(BIAYA_MAX_RP)
  readonly biayaRp?: number | null;
}