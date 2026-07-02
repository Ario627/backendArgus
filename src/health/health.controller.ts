import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from 'src/common/decorators/roles.decorator';
import { RawResponse } from 'src/common/decorators/raw-response.decorator';

interface HealthResponse {
  status: 'ok' | 'degraded';
  db: boolean;
  mqtt: boolean;
  timestamp: string;
}

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Public()
  @RawResponse()
  @Get()
  async check(): Promise<HealthResponse> {
    const db = await this.checkDb();
    const mqtt = true;
    return {
      status: db && mqtt ? 'ok' : 'degraded',
      db,
      mqtt,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDb(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
