import { IsIn } from 'class-validator';
import {
  CONFIRMABLE_STOP_STATUSES,
  type ConfirmableStopStatus,
} from '../../common/constant/domain.constant.js';

export class ConfirmStopDto {
  @IsIn(CONFIRMABLE_STOP_STATUSES)
  readonly status!: ConfirmableStopStatus;
}