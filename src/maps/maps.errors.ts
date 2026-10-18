import { BadRequestException } from '@nestjs/common';

export const directionsCoordinateError = (): BadRequestException =>
  new BadRequestException({
    code: 'MAPS_COORDINATE_INVALID',
    message: 'Koordinat tidak valid. Gunakan format lat,lng',
  });
