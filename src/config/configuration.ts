import { registerAs } from '@nestjs/config';

export const NODE_ENVIRONMENTS = Object.freeze([
  'development',
  'test',
  'production',
] as const);
export const LOG_LEVELS = Object.freeze([
  'debug',
  'info',
  'warn',
  'error',
] as const);

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

export type StorageDriver = 'filesystem' | 's3' | 'cloudinary';

export const STORAGE_DRIVERS = Object.freeze([
  'filesystem',
  's3',
  'cloudinary',
] as const);

export interface StorageConfig {
  readonly driver: StorageDriver;
  readonly dir: string;
  readonly publicApiUrl: string;
  readonly urlSecret: string;
  readonly endpoint: string;
  readonly bucket: string;
  readonly accessKey: string;
  readonly secretKey: string;
  readonly region: string;
  readonly cloudinary: {
    readonly cloudName: string | null;
    readonly apiKey: string | null;
    readonly apiSecret: string | null;
    readonly folder: string;
  };
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
  readonly reconnectPeriodMs: number;
  readonly connectTimeoutMs: number;
  readonly sessionExpirySeconds: number;
  readonly caPath: string | null;
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

export interface AnalyticsConfig {
  readonly url: string;
  readonly token: string;
  readonly timeoutMs: number;
  readonly lookbackDays: number;
  readonly maxSppgPerScan: number;
  readonly sampleSize: number;
  readonly sampleMin: number;
}

export interface OptimizerConfig {
  readonly url: string;
  readonly token: string;
  readonly timeoutMs: number;
  readonly recoveryTimeoutMs: number;
  readonly recoveryTargetMs: number;
}

export interface LlmConfig {
  readonly provider: string | null;
  readonly apiKey: string | null;
  readonly model: string | null;
  readonly baseUrl: string | null;
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
}

export interface NarrativeConfig {
  readonly ttlMinutes: number;
  readonly dailyLimit: number;
  readonly maxChars: number;
  readonly retryAfterSeconds: number;
}

export interface ExportConfig {
  readonly pdfMaxRows: number;
}

export interface LivenessConfig {
  readonly staleThresholdSeconds: number;
  readonly offlineThresholdSeconds: number;
  readonly watchdogIntervalSeconds: number;
}

export interface TelemetryConfig {
  readonly maxAgeSeconds: number;
  readonly futureSkewSeconds: number;
  readonly burstLimit: number;
  readonly refillPerSecond: number;
}

export interface DeviceConfig {
  readonly secretEncKey: string;
  readonly autoLinkWindowSeconds: number;
  readonly pendingMaxAgeHours: number;
  readonly sweepIntervalSeconds: number;
}

export interface RouteConfig {
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly timeLimitSeconds: number;
  readonly fallbackSpeedKmh: number;
  readonly recoveryIntervalSeconds: number;
}

export interface DispositionConfig {
  readonly candidateRadiusKm: number;
}

export interface ChainConfig {
  readonly verifyDailyBatches: number;
  readonly verifySamplePercent: number;
}

export interface RetentionConfig {
  readonly compressAfterDays: number;
  readonly dropAfterDays: number;
  readonly photoTicketDays: number;
  readonly photoBatchDays: number;
  readonly maxPhotosPerRun: number;
  readonly purgeEnabled: boolean;
}

export interface OpsConfig {
  readonly webhookUrl: string | null;
  readonly webhookTimeoutMs: number;
  readonly alertCooldownSeconds: number;
}

export interface StrukConfig {
  readonly tokenSecret: string;
  readonly ttlHours: number;
}

export interface ThrottleConfig {
  readonly globalPerMin: number;
  readonly ticketPerHour: number;
  readonly ticketPerDayPerSppg: number;
  readonly exportPerDay: number;
}

export interface RoutingConfig {
  readonly googleKey: string | null;
  readonly osrmBaseUrl: string;
  readonly trafficEnabled: boolean;
  readonly alternatives: number;
  readonly timeoutMs: number;
}

export interface DispatchConfig {
  readonly autoOnCreate: boolean;
  readonly maxPerRun: number;
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
  readonly routing: RoutingConfig;
  readonly dispatch: DispatchConfig;
  readonly optimizer: OptimizerConfig;
  readonly analytics: AnalyticsConfig;
  readonly llm: LlmConfig;
  readonly liveness: LivenessConfig;
  readonly telemetry: TelemetryConfig;
  readonly device: DeviceConfig;
  readonly route: RouteConfig;
  readonly disposition: DispositionConfig;
  readonly chain: ChainConfig;
  readonly retention: RetentionConfig;
  readonly ops: OpsConfig;
  readonly struk: StrukConfig;
  readonly narrative: NarrativeConfig;
  readonly export: ExportConfig;
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

  const secret = (
    key: string,
    minLength: number,
    devFallback: string,
  ): string => {
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

  const integer = (
    key: string,
    fallback: number,
    min: number,
    max: number,
  ): number => {
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

  const enumeration = <T extends string>(
    key: string,
    allowed: readonly T[],
    fallback: T,
  ): T => {
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

const CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const buildConfiguration = (env: RawEnv): AppConfiguration => {
  const baseReader = createReaders({ env, strict: false });
  const readClock = (key: string, fallback: string): string => {
    const raw = readRaw(env, key) ?? fallback;
    if (!CLOCK_PATTERN.test(raw)) return fail(key, 'harus format HH:MM');
    return raw;
  };
  const nodeEnv = baseReader.enumeration(
    'NODE_ENV',
    NODE_ENVIRONMENTS,
    'development',
  );
  const isProduction = nodeEnv === 'production';
  const reader = createReaders({ env, strict: isProduction });
  const mqttUrl = reader.text('MQTT_URL', 'mqtt://localhost:1883');

  if (isProduction && !mqttUrl.startsWith('mqtts://')) {
    fail('MQTT_URL', 'wajib memakai skema mqtts:// di produksi');
  }

  const opsWebhookUrl = reader.optionalText('OPS_WEBHOOK_URL');
  if (opsWebhookUrl !== null) {
    try {
      new URL(opsWebhookUrl);
    } catch {
      fail('OPS_WEBHOOK_URL', 'harus URL absolut yang valid');
    }
  }
  const llmBaseUrl = reader.optionalText('LLM_BASE_URL');
  if (llmBaseUrl !== null) {
    try {
      const parsed = new URL(llmBaseUrl);
      if (parsed.search !== '' || parsed.hash !== '') {
        fail('LLM_BASE_URL', 'tidak boleh memuat query atau fragmen');
      }
      if (isProduction && parsed.protocol !== 'https:') {
        fail('LLM_BASE_URL', 'wajib memakai skema https di produksi');
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('ENV_INVALID')) {
        throw error;
      }
      fail('LLM_BASE_URL', 'harus URL absolut yang valid');
    }
  }

  return Object.freeze({
    nodeEnv,
    isProduction,
    port: reader.integer('PORT', 3000, 1, 65535),
    frontendUrl: reader.url('FRONTEND_URL', 'http://localhost:5173'),
    publicAppUrl: reader.url('PUBLIC_APP_URL', 'http://localhost:5173'),
    requestTimeoutMs: reader.integer('REQUEST_TIMEOUT_MS', 15000, 1000, 120000),
    requestMaxBodyBytes: reader.integer(
      'REQUEST_MAX_BODY_BYTES',
      262144,
      1024,
      10485760,
    ),
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
      driver: reader.enumeration('STORAGE_DRIVER', STORAGE_DRIVERS, 'filesystem'),
      dir: reader.text('STORAGE_DIR', './var/photos'),
      publicApiUrl: reader.url(
        'PUBLIC_API_URL',
        `http://localhost:${reader.integer('PORT', 3000, 1, 65535)}/api/v1`,
      ),
      urlSecret: reader.secret(
        'PHOTO_URL_SECRET',
        32,
        'dev-only-photo-url-secret-0123456789abcdef',
      ),
      endpoint: reader.url('S3_ENDPOINT', 'http://localhost:9000'),
      bucket: reader.text('S3_BUCKET', 'argus-photos'),
      accessKey: reader.secret('S3_ACCESS_KEY', 8, 'argus-minio-access'),
      secretKey: reader.secret('S3_SECRET_KEY', 8, 'argus-minio-secret'),
      region: reader.text('S3_REGION', 'us-east-1'),
      cloudinary: Object.freeze({
        cloudName: reader.optionalText('CLOUDINARY_CLOUD_NAME'),
        apiKey: reader.optionalText('CLOUDINARY_API_KEY'),
        apiSecret: reader.optionalText('CLOUDINARY_API_SECRET'),
        folder: reader.text('CLOUDINARY_FOLDER', 'argus/photos'),
      }),
      signedUrlTtlSeconds: reader.integer(
        'PHOTO_SIGNED_URL_TTL_SECONDS',
        900,
        60,
        3600,
      ),
      photoMaxBytes: reader.integer('PHOTO_MAX_BYTES', 2097152, 1024, 10485760),
    }),
    auth: Object.freeze({
      jwtSecret: reader.secret(
        'JWT_SECRET',
        64,
        'dev-only-jwt-secret-change-me-0123456789-abcdefghijklmnopqrstuvwxyz',
      ),
      jwtExpiresIn: reader.text('JWT_EXPIRES_IN', '8h'),
      bcryptRounds: reader.integer('BCRYPT_ROUNDS', 12, 10, 15),
      ipHashSalt: reader.secret(
        'IP_HASH_SALT',
        32,
        'dev-only-ip-hash-salt-0123456789abcdef',
      ),
    }),
    mqtt: Object.freeze({
      url: mqttUrl,
      clientId: reader.text('MQTT_CLIENT_ID', 'argus-backend'),
      username: reader.text('MQTT_USERNAME', 'argus-backend'),
      password: reader.secret('MQTT_PASSWORD', 8, 'argus-dev-mqtt'),
      reconnectPeriodMs: reader.integer(
        'MQTT_RECONNECT_PERIOD_MS',
        5000,
        1000,
        60000,
      ),
      connectTimeoutMs: reader.integer(
        'MQTT_CONNECT_TIMEOUT_MS',
        10000,
        3000,
        60000,
      ),
      sessionExpirySeconds: reader.integer(
        'MQTT_SESSION_EXPIRY_SECONDS',
        604800,
        60,
        2678400,
      ),
      caPath: reader.optionalText('MQTT_CA_PATH'),
      scaleTimeSkewSeconds: reader.integer(
        'SCALE_TIME_SKEW_SECONDS',
        120,
        30,
        3600,
      ),
    }),
    mapbox: Object.freeze({
      token: reader.optionalText('MAPBOX_TOKEN'),
      timeoutMs: reader.integer('MAPBOX_TIMEOUT_MS', 8000, 1000, 60000),
    }),
    routing: Object.freeze({
      googleKey: reader.optionalText('GOOGLE_MAPS_API_KEY'),
      osrmBaseUrl: reader.url('OSRM_BASE_URL', 'https://router.project-osrm.org'),
      trafficEnabled: reader.boolean('ROUTING_TRAFFIC', true),
      alternatives: reader.integer('ROUTING_ALTERNATIVES', 3, 1, 5),
      timeoutMs: reader.integer('ROUTING_TIMEOUT_MS', 8000, 1000, 60000),
    }),
    dispatch: Object.freeze({
      autoOnCreate: reader.boolean('DISPATCH_AUTO_ON_CREATE', true),
      maxPerRun: reader.integer('DISPATCH_MAX_PER_RUN', 8, 1, 50),
    }),
    optimizer: Object.freeze({
      url: reader.url('OPTIMIZER_URL', 'http://localhost:8100'),
      token: reader.secret('OPTIMIZER_TOKEN', 32, ''),
      timeoutMs: reader.integer('OPTIMIZER_TIMEOUT_MS', 12000, 1000, 120000),
      recoveryTimeoutMs: reader.integer(
        'SWARM_RECOVERY_OPT_TIMEOUT_MS',
        15000,
        1000,
        120000,
      ),
      recoveryTargetMs: reader.integer(
        'SWARM_RECOVERY_TARGET_MS',
        60000,
        5000,
        600000,
      ),
    }),
    analytics: Object.freeze({
      url: reader.url('ANALYTICS_URL', 'http://localhost:8200'),
      token: reader.secret('ANALYTICS_TOKEN', 32, ''),
      timeoutMs: reader.integer('ANALYTICS_TIMEOUT_MS', 10000, 1000, 120000),
      lookbackDays: reader.integer('DIGIT_LOOKBACK_DAYS', 90, 7, 365),
      maxSppgPerScan: reader.integer('DIGIT_MAX_SPPG_PER_SCAN', 20, 1, 200),
      sampleSize: reader.integer('DIGIT_SAMPLE_SIZE', 30, 1, 500),
      sampleMin: reader.integer('DIGIT_SAMPLE_MIN', 30, 1, 500),
    }),
    llm: Object.freeze({
      provider: reader.optionalText('LLM_PROVIDER'),
      apiKey: reader.optionalText('LLM_API_KEY'),
      model: reader.optionalText('LLM_MODEL'),
      baseUrl: llmBaseUrl,
      maxOutputTokens: reader.integer('LLM_MAX_OUTPUT_TOKENS', 320, 64, 2000),
      timeoutMs: reader.integer('LLM_TIMEOUT_MS', 15000, 1000, 120000),
    }),
    liveness: Object.freeze({
      staleThresholdSeconds: reader.integer(
        'STALE_THRESHOLD_SECONDS',
        180,
        30,
        3600,
      ),
      offlineThresholdSeconds: reader.integer(
        'OFFLINE_THRESHOLD_SECONDS',
        600,
        60,
        86400,
      ),
      watchdogIntervalSeconds: reader.integer(
        'WATCHDOG_INTERVAL_SECONDS',
        60,
        10,
        600,
      ),
    }),
    telemetry: Object.freeze({
      maxAgeSeconds: reader.integer(
        'TELEMETRY_MAX_AGE_SECONDS',
        604800,
        60,
        2592000,
      ),
      futureSkewSeconds: reader.integer(
        'TELEMETRY_FUTURE_SKEW_SECONDS',
        300,
        30,
        3600,
      ),
      burstLimit: reader.integer('TELEMETRY_BURST_LIMIT', 600, 10, 100000),
      refillPerSecond: reader.integer(
        'TELEMETRY_REFILL_PER_SECOND',
        2,
        1,
        1000,
      ),
    }),
    route: Object.freeze({
      windowStart: readClock('ROUTE_WINDOW_START', '09:00'),
      windowEnd: readClock('ROUTE_WINDOW_END', '15:00'),
      timeLimitSeconds: reader.integer('ROUTE_TIME_LIMIT_SECONDS', 10, 1, 120),
      fallbackSpeedKmh: reader.integer('ROUTE_FALLBACK_SPEED_KMH', 25, 5, 80),
      recoveryIntervalSeconds: reader.integer(
        'ROUTE_RECOVERY_INTERVAL_SECONDS',
        30,
        10,
        3600,
      ),
    }),
    device: Object.freeze({
      secretEncKey: reader.secret(
        'DEVICE_SECRET_ENC_KEY',
        64,
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      ),
      autoLinkWindowSeconds: reader.integer(
        'SCALE_AUTO_LINK_WINDOW_SECONDS',
        120,
        30,
        600,
      ),
      pendingMaxAgeHours: reader.integer(
        'SCALE_PENDING_MAX_AGE_HOURS',
        24,
        1,
        168,
      ),
      sweepIntervalSeconds: reader.integer(
        'SCALE_SWEEP_INTERVAL_SECONDS',
        300,
        30,
        3600,
      ),
    }),
    disposition: Object.freeze({
      candidateRadiusKm: reader.integer('CANDIDATE_RADIUS_KM', 25, 1, 200),
    }),
    chain: Object.freeze({
      verifyDailyBatches: reader.integer(
        'CHAIN_VERIFY_DAILY_BATCHES',
        100,
        1,
        10000,
      ),
      verifySamplePercent: reader.integer(
        'CHAIN_VERIFY_SAMPLE_PERCENT',
        5,
        1,
        100,
      ),
    }),
    retention: Object.freeze({
      compressAfterDays: reader.integer(
        'TELEMETRY_COMPRESS_AFTER_DAYS',
        7,
        1,
        365,
      ),
      dropAfterDays: reader.integer('TELEMETRY_DROP_AFTER_DAYS', 90, 1, 3650),
      photoTicketDays: reader.integer(
        'PHOTO_TICKET_RETENTION_DAYS',
        366,
        30,
        3650,
      ),
      photoBatchDays: reader.integer(
        'PHOTO_BATCH_RETENTION_DAYS',
        731,
        30,
        3650,
      ),
      maxPhotosPerRun: reader.integer('PHOTO_PURGE_MAX_PER_RUN', 200, 1, 1000),
      purgeEnabled: reader.boolean('RETENTION_PURGE_ENABLED', false),
    }),
    ops: Object.freeze({
      webhookUrl: opsWebhookUrl,
      alertCooldownSeconds: reader.integer(
        'OPS_ALERT_COOLDOWN_SECONDS',
        900,
        0,
        86400,
      ),
      webhookTimeoutMs: reader.integer(
        'OPS_WEBHOOK_TIMEOUT_MS',
        5000,
        1000,
        30000,
      ),
    }),
    narrative: Object.freeze({
      ttlMinutes: reader.integer('NARRATIVE_TTL_MINUTES', 360, 5, 10080),
      dailyLimit: reader.integer('NARRATIVE_DAILY_LIMIT', 40, 1, 1000),
      maxChars: reader.integer('NARRATIVE_MAX_CHARS', 700, 200, 2000),
      retryAfterSeconds: reader.integer(
        'NARRATIVE_RETRY_AFTER_SECONDS',
        3,
        1,
        30,
      ),
    }),
    export: Object.freeze({
      pdfMaxRows: reader.integer('EXPORT_PDF_MAX_ROWS', 2000, 1, 20000),
    }),
    struk: Object.freeze({
      tokenSecret: reader.secret(
        'STRUK_TOKEN_SECRET',
        32,
        'dev-only-struk-token-secret-0123456789',
      ),
      ttlHours: reader.integer('STRUK_TOKEN_TTL_HOURS', 720, 1, 8760),
    }),
    throttle: Object.freeze({
      globalPerMin: reader.integer('THROTTLE_GLOBAL_PER_MIN', 100, 1, 100000),
      ticketPerHour: reader.integer('TICKET_RATE_PER_HOUR', 3, 1, 1000),
      ticketPerDayPerSppg: reader.integer(
        'TICKET_RATE_PER_DAY_PER_SPPG',
        20,
        1,
        10000,
      ),
      exportPerDay: reader.integer('EXPORT_RATE_PER_DAY', 10, 1, 1000),
    }),
    demoMode: reader.boolean('DEMO_MODE', false),
  });
};

export default registerAs('app', () => buildConfiguration(process.env));
