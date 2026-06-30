import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'raw_response';

export const RawResponse = (): MethodDecorator & ClassDecorator =>
  SetMetadata(RAW_RESPONSE_KEY, true);