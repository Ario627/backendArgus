import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('app.port') ?? 3001;
  const frontendUrl =
    config.get<string>('app.frontendUrl') ?? 'http://localhost:3000';

  const mqtt = config.get<{
    brokerUrl: string;
    username: string;
    password: string;
    reconnectPeriodMs: number;
    connectTimeoutMs: number;
  }>('app.mqtt')!;

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.MQTT,
      options: {
        url: mqtt.brokerUrl,
        username: mqtt.username || undefined,
        password: mqtt.password || undefined,
        reconnectPeriod: mqtt.reconnectPeriodMs,
        connectTimeout: mqtt.connectTimeoutMs,
      },
    },
    { inheritAppConfig: true },
  );

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: [
            "'self'",
            'data:',
            'https://*.mapbox.com',
            'https://api.mapbox.com',
          ],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", 'https://api.mapbox.com', 'wss:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  process.on('uncaughtException', (err) => {
    new Logger('Bootstrap').error(
      `uncaughtException: ${err.message}`,
      err.stack,
    );
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    new Logger('Bootstrap').error(`unhandledRejection: ${String(reason)}`);
    process.exit(1);
  });

  await app.startAllMicroservices();
  await app.listen(port);
  new Logger('Bootstrap').log(`ARGUS backend listening on :${port}`);
  new Logger('Bootstrap').log(`WebSocket gateway on /telemetry`);
  new Logger('Bootstrap').log(`MQTT subscriber connected to ${mqtt.brokerUrl} (topics: fleet/+/telemetry, telemetry/destination/+)`);
}

bootstrap();