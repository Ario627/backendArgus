import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MapsClientService } from './maps-client.service';

@Module({
  imports: [HttpModule],
  providers: [MapsClientService],
  exports: [MapsClientService],
})
export class MapsModule {}