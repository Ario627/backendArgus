import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',

  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL ?? 'mqtt://localhost:1883',
    telemetryTopic:
      process.env.MQTT_TELEMETRY_TOPIC ?? 'fleet/+/telemetry',
    reconnectPeriodMs: parseInt(
      process.env.MQTT_RECONNECT_PERIOD_MS ?? '5000',
      10,
    ),
    connectTimeoutMs: parseInt(
      process.env.MQTT_CONNECT_TIMEOUT_MS ?? '10000',
      10,
    ),
    username: process.env.MQTT_USERNAME ?? '',
    password: process.env.MQTT_PASSWORD ?? '',
  },

  database: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://argus:argus@localhost:5432/argus',
    poolSize: parseInt(process.env.DB_POOL_SIZE ?? '10', 10),
  },

  mapbox: {
    apiKey: process.env.MAPBOX_API_KEY ?? '',
    timeoutMs: parseInt(process.env.MAPBOX_TIMEOUT_MS ?? '10000', 10),
  },

  llm: {
    apiKey: process.env.LLM_PROVIDER_API_KEY ?? '',
    url:
      process.env.LLM_PROVIDER_URL ??
      'https://api.groq.com/openai/v1/chat/completions',
    model:
      process.env.LLM_PROVIDER_MODEL ?? 'llama-3.3-70b-versatile',
    timeoutMs: parseInt(
      process.env.LLM_PROVIDER_TIMEOUT_MS ?? '15000',
      10,
    ),
  },

  optimization: {
    engineUrl:
      process.env.OPTIMIZATION_ENGINE_URL ?? 'http://localhost:8001',
    engineTimeoutMs: parseInt(
      process.env.OPTIMIZATION_ENGINE_TIMEOUT_MS ?? '20000',
      10,
    ),
    swarmRecoveryTargetMs: parseInt(
      process.env.SWARM_RECOVERY_TARGET_MS ?? '60000',
      10,
    ),
    swarmRecoveryOptTimeoutMs: parseInt(
      process.env.SWARM_RECOVERY_OPT_TIMEOUT_MS ?? '15000',
      10,
    ),
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me-min-32-chars-please',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },

  liveness: {
    staleThresholdSeconds: parseInt(
      process.env.STALE_THRESHOLD_SECONDS ?? '180',
      10,
    ),
    offlineThresholdSeconds: parseInt(
      process.env.OFFLINE_THRESHOLD_SECONDS ?? '600',
      10,
    ),
    watchdogIntervalSeconds: parseInt(
      process.env.WATCHDOG_INTERVAL_SECONDS ?? '60',
      10,
    ),
  },

  telemetryRetention: {
    compressAfterDays: parseInt(
      process.env.TELEMETRY_COMPRESS_AFTER_DAYS ?? '7',
      10,
    ),
    dropAfterDays: parseInt(
      process.env.TELEMETRY_DROP_AFTER_DAYS ?? '90',
      10,
    ),
  },

  volumeAnomaly: {
    lowVolumeThreshold: parseFloat(
      process.env.LOW_VOLUME_THRESHOLD ?? '0.20',
    ),
    movingAverageWindowDays: parseInt(
      process.env.MOVING_AVERAGE_WINDOW_DAYS ?? '7',
      10,
    ),
  },
}));
