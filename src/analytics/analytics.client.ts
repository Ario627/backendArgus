import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { AppConfiguration } from '../config/configuration.js';
import type {
  AnalyticsRequest,
  AnalyticsResponse,
} from './analytics.contract.js';
import { parseAnalyticsResponse } from './analytics-response.util.js';

const MAX_RESPONSE_BYTES = 1048576;

@Injectable()
export class AnalyticsClient {
  private readonly logger = new Logger(AnalyticsClient.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(configService: ConfigService) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.baseUrl = config.analytics.url;
    this.token = config.analytics.token;
    this.timeoutMs = config.analytics.timeoutMs;
  }

  async analyze(request: AnalyticsRequest): Promise<AnalyticsResponse | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await axios.post<unknown>(
        `${this.baseUrl}/analyze/anomalies`,
        request,
        {
          timeout: this.timeoutMs,
          signal: controller.signal,
          maxContentLength: MAX_RESPONSE_BYTES,
          maxBodyLength: MAX_RESPONSE_BYTES,
          headers:
            this.token === ''
              ? { 'content-type': 'application/json' }
              : {
                  'content-type': 'application/json',
                  'x-internal-token': this.token,
                },
        },
      );
      const parsed = parseAnalyticsResponse(response.data);
      if (parsed === null) {
        this.logger.warn('respons analytics tidak lolos validasi kontrak');
      }
      return parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN';
      this.logger.warn(`analytics tidak tersedia: ${message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}