import { registerAs } from "@nestjs/config";

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',

  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL ?? 'mqtt://localhost:1883',
    telemetryTopic: process.env.MQTT_TELEMETRY_TOPIC ?? 'fleet/+/telemetry',
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

  
}));