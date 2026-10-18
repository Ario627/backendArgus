import 'reflect-metadata';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { requestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { validationExceptionFactory } from './common/pipes/validation-exception.factory.js';
import type { AppConfiguration } from './config/configuration.js';

const GLOBAL_PREFIX = 'api/v1';

const buildHelmetOptions = (isProduction: boolean) => ({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      'default-src': "'none'",
      'base-uri': "'none'",
      'form-action': "'none'",
      'frame-ancestors': "'none'",
    },
  },
  referrerPolicy: { policy: 'no-referrer' as const },
  frameguard: { action: 'deny' as const },
  hsts: isProduction
    ? { maxAge: 15552000, includeSubDomains: false, preload: false }
    : false,
  crossOriginEmbedderPolicy: false,
});

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const configService = app.get(ConfigService);
  const config = configService.getOrThrow<AppConfiguration>('app');

  app.set('trust proxy', config.trustProxyHops);
  app.use(requestIdMiddleware);
  app.use(helmet(buildHelmetOptions(config.isProduction)));
  app.use(compression());
  app.useBodyParser('json', { limit: config.requestMaxBodyBytes });

  app.enableCors({
    origin: [config.frontendUrl],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    exposedHeaders: [
      'X-Request-Id',
      'X-Export-Rows',
      'X-Export-Pages',
      'X-Export-Truncated',
      'X-Export-Quota-Remaining',
    ],
    credentials: false,
    maxAge: 600,
  });

  app.setGlobalPrefix(GLOBAL_PREFIX, {
    exclude: [{ path: 'health', method: RequestMethod.ALL }],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false, value: false },
      exceptionFactory: validationExceptionFactory,
    }),
  );

  app.enableShutdownHooks();

  await app.listen(config.port);
  Logger.log(`ARGUS backend aktif di port ${config.port}`, 'Bootstrap');
};

const handleFatal = (error: unknown): void => {
  Logger.error(
    error instanceof Error ? error.message : 'non-error thrown',
    error instanceof Error ? error.stack : undefined,
    'Bootstrap',
  );
  process.exit(1);
};

process.on('uncaughtException', handleFatal);
process.on('unhandledRejection', handleFatal);

bootstrap().catch(handleFatal);