import { registerAs } from '@nestjs/config';

export const NODE_ENVIRONMENTS = Object.freeze(['development', 'test', 'production'] as const);
export const LOG_LEVELS = Object.freeze(['debug', 'info', 'warn', 'error'] as const);

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly name: string;
  readonly user: string;
  readonly password: string;
  readonly poolSize: number;
  readonly ssl: boolean;
  readonly migrationsRun: boolean;
}

export interface StorageConfig {
  readonly endpoint: string;
  readonly bucket: string;
  readonly accessKey: string;
  readonly secretKey: string;
  readonly region: string;
  readonly signedUrlTtlSeconds: number;
  readonly photoMaxBytes: number;
}

export interface AuthConfig {
  readonly jwtSecret: string;
  readonly jwtExpiresIn: string;
  readonly bcryptRounds: number;
  readonly ipHashSalt: string;
}

export interface MqttConfig {
  readonly url: string;
  readonly clientId: string;
  readonly username: string;
  readonly password: string;
  readonly scaleTimeSkewSeconds: number;
}

export interface MapboxConfig {
  readonly token: string | null;
  readonly timeoutMs: number;
}

export interface ExternalServiceConfig {
  readonly url: string;
  readonly timeoutMs: number;
}

export interface LlmConfig {
  readonly provider: string | null;
  readonly apiKey: string | null;
  readonly model: string | null;
  readonly timeoutMs: number;
}

export interface LivenessConfig {
  readonly staleThresholdSeconds: number;
  readonly offlineThresholdSeconds: number;
  readonly watchdogIntervalSeconds: number;
}

export interface DispositionConfig {
  readonly candidateRadiusKm: number;
}

export interface ChainConfig {
  readonly verifyDailyBatches: number;
  readonly verifySamplePercent: number;
}

export interface ThrottleConfig {
  readonly globalPerMin: number;
  readonly ticketPerHour: number;
  readonly ticketPerDayPerSppg: number;
}

export interface AppConfiguration {
  readonly nodeEnv: NodeEnvironment;
  readonly isProduction: boolean;
  readonly port: number;
  readonly frontendUrl: string;
  readonly publicAppUrl: string;
  readonly requestTimeoutMs: number;
  readonly requestMaxBodyBytes: number;
  readonly trustProxyHops: number;
  readonly logLevel: LogLevel;
  readonly logRetentionDays: number;
  readonly database: DatabaseConfig;
  readonly storage: StorageConfig;
  readonly auth: AuthConfig;
  readonly mqtt: MqttConfig;
  readonly mapbox: MapboxConfig;
  readonly optimizer: ExternalServiceConfig;
  readonly analytics: ExternalServiceConfig;
  readonly llm: LlmConfig;
  readonly liveness: LivenessConfig;
  readonly disposition: DispositionConfig;
  readonly chain: ChainConfig;
  readonly throttle: ThrottleConfig;
  readonly demoMode: boolean;
}

type RawEnv = Readonly<Record<string, string | undefined>>;

const fail = (key: string, reason: string): never => {
  throw new Error(`ENV_INVALID ${key}: ${reason}`);
};

const readRaw = (env: RawEnv, key: string): string | null => {
  const value = env[key];
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

interface ReaderContext {
  readonly env: RawEnv;
  readonly strict: boolean;
}

const createReaders = ({ env, strict }: ReaderContext) => {
  const text = (key: string, devFallback: string): string => {
    const raw = readRaw(env, key);
    if (raw !== null) {
      return raw;
    }
    return strict ? fail(key, 'wajib diisi di produksi') : devFallback;
  };

  const optionalText = (key: string): string | null => readRaw(env, key);

  const secret = (key: string, minLength: number, devFallback: string): string => {
    const raw = readRaw(env, key);
    if (raw === null) {
      return strict ? fail(key, 'wajib diisi di produksi') : devFallback;
    }
    if (strict && raw.length < minLength) {
      return fail(key, `wajib minimal ${minLength} karakter di produksi`);
    }
    return raw;
  };

  const url = (key: string, devFallback: string): string => {
    const raw = text(key, devFallback);
    try {
      new URL(raw);
      return raw;
    } catch {
      return fail(key, 'harus URL absolut yang valid');
    }
  };

  const integer = (key: string, fallback: number, min: number, max: number): number => {
    const raw = readRaw(env, key);
    if (raw === null) {
      return fallback;
    }
    if (!/^-?\d+$/.test(raw)) {
      return fail(key, 'harus bilangan bulat');
    }
    const parsed = Number.parseInt(raw, 10);
    if (parsed < min || parsed > max) {
      return fail(key, `harus bernilai antara ${min} dan ${max}`);
    }
    return parsed;
  };

  const boolean = (key: string, fallback: boolean): boolean => {
    const raw = readRaw(env, key);
    if (raw === null) {
      return fallback;
    }
    if (raw === 'true') {
      return true;
    }
    if (raw === 'false') {
      return false;
    }
    return fail(key, 'harus "true" atau "false"');
  };

  const enumeration = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const raw = readRaw(env, key);
    if (raw === null) {
      return fallback;
    }
    if (!(allowed as readonly string[]).includes(raw)) {
      return fail(key, `harus salah satu dari: ${allowed.join(', ')}`);
    }
    return raw as T;
  };

  return { text, optionalText, secret, url, integer, boolean, enumeration };
};

export const buildConfiguration = (env: RawEnv): AppConfiguration => {
  const baseReader = createReaders({ env, strict: false });
  const nodeEnv = baseReader.enumeration('NODE_ENV', NODE_ENVIRONMENTS, 'development');
  const isProduction = nodeEnv === 'production';
  const reader = createReaders({ env, strict: isProduction });
  const mqttUrl = reader.text('MQTT_URL', 'mqtt://localhost:1883');

  if (isProduction && !mqttUrl.startsWith('mqtts://')) {
    fail('MQTT_URL', 'wajib memakai skema mqtts:// di produksi');
  }

  return Object.freeze({
    nodeEnv,
    isProduction,
    port: reader.integer('PORT', 3000, 1, 65535),
    frontendUrl: reader.url('FRONTEND_URL', 'http://localhost:5173'),
    publicAppUrl: reader.url('PUBLIC_APP_URL', 'http://localhost:5173'),
    requestTimeoutMs: reader.integer('REQUEST_TIMEOUT_MS', 15000, 1000, 120000),
    requestMaxBodyBytes: reader.integer('REQUEST_MAX_BODY_BYTES', 262144, 1024, 10485760),
    trustProxyHops: reader.integer('TRUST_PROXY_HOPS', 0, 0, 10),
    logLevel: reader.enumeration('LOG_LEVEL', LOG_LEVELS, 'info'),
    logRetentionDays: reader.integer('LOG_RETENTION_DAYS', 90, 1, 3650),
    database: Object.freeze({
      host: reader.text('DB_HOST', 'localhost'),
      port: reader.integer('DB_PORT', 5432, 1, 65535),
      name: reader.text('DB_NAME', 'argus'),
      user: reader.text('DB_USER', 'argus'),
      password: reader.secret('DB_PASSWORD', 8, 'argus-dev-password'),
      poolSize: reader.integer('DB_POOL_SIZE', 10, 1, 100),
      ssl: reader.boolean('DB_SSL', false),
      migrationsRun: reader.boolean('MIGRATIONS_RUN', false),
    }),
    storage: Object.freeze({
      endpoint: reader.url('S3_ENDPOINT', 'http://localhost:9000'),
      bucket: reader.text('S3_BUCKET', 'argus-photos'),
      accessKey: reader.secret('S3_ACCESS_KEY', 8, 'argus-minio-access'),
      secretKey: reader.secret('S3_SECRET_KEY', 8, 'argus-minio-secret'),
      region: reader.text('S3_REGION', 'us-east-1'),
      signedUrlTtlSeconds: reader.integer('PHOTO_SIGNED_URL_TTL_SECONDS', 900, 60, 3600),
      photoMaxBytes: reader.integer('PHOTO_MAX_BYTES', 1048576, 1024, 10485760),
    }),
    auth: Object.freeze({
      jwtSecret: reader.secret(
        'JWT_SECRET',
        64,
        'dev-only-jwt-secret-change-me-0123456789-abcdefghijklmnopqrstuvwxyz',
      ),
      jwtExpiresIn: reader.text('JWT_EXPIRES_IN', '8h'),
      bcryptRounds: reader.integer('BCRYPT_ROUNDS', 12, 10, 15),
      ipHashSalt: reader.secret('IP_HASH_SALT', 32, 'dev-only-ip-hash-salt-0123456789abcdef'),
    }),
    mqtt: Object.freeze({
      url: mqttUrl,
      clientId: reader.text('MQTT_CLIENT_ID', 'argus-backend'),
      username: reader.text('MQTT_USERNAME', 'argus-backend'),
      password: reader.secret('MQTT_PASSWORD', 8, 'argus-dev-mqtt'),
      scaleTimeSkewSeconds: reader.integer('SCALE_TIME_SKEW_SECONDS', 120, 30, 3600),
    }),
    mapbox: Object.freeze({
      token: reader.optionalText('MAPBOX_TOKEN'),
      timeoutMs: reader.integer('MAPBOX_TIMEOUT_MS', 8000, 1000, 60000),
    }),
    optimizer: Object.freeze({
      url: reader.url('OPTIMIZER_URL', 'http://localhost:8100'),
      timeoutMs: reader.integer('OPTIMIZER_TIMEOUT_MS', 12000, 1000, 120000),
    }),
    analytics: Object.freeze({
      url: reader.url('ANALYTICS_URL', 'http://localhost:8200'),
      timeoutMs: reader.integer('ANALYTICS_TIMEOUT_MS', 10000, 1000, 120000),
    }),
    llm: Object.freeze({
      provider: reader.optionalText('LLM_PROVIDER'),
      apiKey: reader.optionalText('LLM_API_KEY'),
      model: reader.optionalText('LLM_MODEL'),
      timeoutMs: reader.integer('LLM_TIMEOUT_MS', 15000, 1000, 120000),
    }),
    liveness: Object.freeze({
      staleThresholdSeconds: reader.integer('STALE_THRESHOLD_SECONDS', 180, 30, 3600),
      offlineThresholdSeconds: reader.integer('OFFLINE_THRESHOLD_SECONDS', 600, 60, 86400),
      watchdogIntervalSeconds: reader.integer('WATCHDOG_INTERVAL_SECONDS', 60, 10, 600),
    }),
    disposition: Object.freeze({
      candidateRadiusKm: reader.integer('CANDIDATE_RADIUS_KM', 25, 1, 200),
    }),
    chain: Object.freeze({
      verifyDailyBatches: reader.integer('CHAIN_VERIFY_DAILY_BATCHES', 100, 1, 10000),
      verifySamplePercent: reader.integer('CHAIN_VERIFY_SAMPLE_PERCENT', 5, 1, 100),
    }),
    throttle: Object.freeze({
      globalPerMin: reader.integer('THROTTLE_GLOBAL_PER_MIN', 100, 1, 100000),
      ticketPerHour: reader.integer('TICKET_RATE_PER_HOUR', 3, 1, 1000),
      ticketPerDayPerSppg: reader.integer('TICKET_RATE_PER_DAY_PER_SPPG', 20, 1, 10000),
    }),
    demoMode: reader.boolean('DEMO_MODE', false),
  });
};

export default registerAs('app', () => buildConfiguration(process.env));