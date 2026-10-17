import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { AppConfiguration } from '../config/configuration.js';
import type {
  OptimizerRequest,
  OptimizerResponse,
} from './optimizer.contract.js';
import { parseOptimizerResponse } from './optimizer-response.util.js';

const MAX_RESPONSE_BYTES = 1048576;

@Injectable()
export class OptimizerClient {
  private readonly logger = new Logger(OptimizerClient.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(configService: ConfigService) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.baseUrl = config.optimizer.url;
    this.timeoutMs = config.optimizer.timeoutMs;
  }

  async solve(
    request: OptimizerRequest,
    overrideTimeoutMs?: number,
  ): Promise<OptimizerResponse | null> {
    const timeoutMs = overrideTimeoutMs ?? this.timeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await axios.post<unknown>(
        `${this.baseUrl}/vrptw`,
        request,
        {
          timeout: timeoutMs,
          signal: controller.signal,
          maxContentLength: MAX_RESPONSE_BYTES,
          maxBodyLength: MAX_RESPONSE_BYTES,
          headers: { 'content-type': 'application/json' },
        },
      );
      const parsed = parseOptimizerResponse(response.data);
      if (parsed === null) {
        this.logger.warn('respons optimizer tidak lolos validasi kontrak');
      }
      return parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN';
      this.logger.warn(`optimizer tidak tersedia: ${message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}