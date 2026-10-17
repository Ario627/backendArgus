import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { MOISTURE_PROXIES, type MoistureProxy } from '../../common/constant/domain.constant.js';

export class ReGateBatchDto {
  @IsOptional()
  @IsIn(MOISTURE_PROXIES)
  readonly moistureProxy?: MoistureProxy;

  @IsOptional()
  @IsBoolean()
  readonly visibleOil?: boolean;
}