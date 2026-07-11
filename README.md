# ARGUS Backend

ARGUS is a telematics and route optimization platform for waste truck fleet management. The backend is a NestJS application that handles real-time telemetry ingestion, route optimization, and fleet command center operations.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Docker Deployment](#docker-deployment)
- [Database Setup](#database-setup)
- [Running Tests](#running-tests)
- [API Documentation](#api-documentation)
- [Modules](#modules)
- [Development Workflow](#development-workflow)
- [Production Considerations](#production-considerations)

## Architecture Overview

### High-Level Design

ARGUS Backend is a microservices-oriented architecture with the following layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer                             │
│                  (Dashboard Frontend)                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              REST API Layer (NestJS)                        │
│  Helmet, CORS, Throttling, Global Validation Pipeline     │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
    ┌────────┐  ┌───────┐  ┌──────────┐
    │Auth    │  │Fleet  │  │Dashboard │
    │Module  │  │Module │  │Module    │
    └────────┘  └───────┘  └──────────┘
        │            │            │
        └────────────┼────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Enrichment Layer                               │
│  ┌─────────────────┐     ┌──────────────┐                 │
│  │Mapbox Directions│     │LLM Engine    │                 │
│  │API Integration  │     │(Groq/Gemini) │                 │
│  └─────────────────┘     └──────────────┘                 │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────────┐
    │Telemetry │ │Recovery  │ │Optimization  │
    │Service   │ │Service   │ │Service       │
    └──────────┘ └──────────┘ └──────────────┘
        │            │            │
        └────────────┼────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           Persistence Layer (TypeORM + PostgreSQL)          │
│  ┌─────────────────┐    ┌──────────────────────┐          │
│  │ Relational Data │    │ TimescaleDB Hypertable │          │
│  │ (fleet, routes) │    │ (telemetry time-series)│         │
│  └─────────────────┘    └──────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Database                            │
└─────────────────────────────────────────────────────────────┘
```

### Core Modules

- **AuthModule**: JWT-based authentication with role-based access control (RBAC: admin, supervisor, driver)
- **FleetModule**: Fleet and vehicle management
- **DestinationModule**: Destination (TPA, RDF, TPS_3R) management
- **TelemetryModule**: Real-time telemetry ingestion from MQTT, anomaly detection
- **RecoveryModule**: Swarm recovery logic for broken vehicles (<60s response time)
- **OptimizationModule**: Bridge to OR-Tools Python service for VRP optimization
- **MapsModule**: Mapbox Directions API integration for distance/duration calculations
- **LlmEngineModule**: Groq/Gemini LLM integration for incident narration (async, non-critical path)
- **DashboardModule**: Command center analytics and visualization
- **MqttModule**: MQTT client for device telemetry subscription
- **HealthModule**: Health checks and monitoring
- **ScheduleModule**: Scheduled tasks (watchdog, retention policies)

### Data Flow: Telemetry → Optimization → Routes

```
ESP32 Device (GPS + Volume + Status)
    │  publish MQTT QoS1
    ▼
MQTT Broker (TLS, per-device auth)
    │  MqttController subscribes
    ▼
TelemetryService
    ├─ Validate & normalize payload
    ├─ Detect anomalies (low volume, stale position)
    ├─ Persist to TimescaleDB hypertable
    ├─ Update fleet operational status
    └─ Trigger recovery if broken (Swarm Recovery <60ms)
        ▼
    RecoveryService (if needed)
        ├─ Query optimization engine (OR-Tools)
        ├─ Redistribute load to nearby healthy vehicles
        └─ Log recovery incident with LLM narration
    ▼
Dashboard API
    ├─ Real-time fleet status
    ├─ Route visualization
    ├─ Recovery incident history
    └─ Volume anomaly alerts
```

## Prerequisites

### Required

- **Node.js** 18.x or higher
- **npm** 9.x or higher (or yarn)
- **PostgreSQL** 14+ with **TimescaleDB** extension
- **MQTT Broker** (Mosquitto or compatible, TLS support)
- **Docker** 20.10+ and **Docker Compose** 2.0+ (for containerized deployment)

### Optional (for full functionality)

- **Mapbox API Key** (for distance/duration calculations)
- **LLM Provider API Key** (Groq or Google Gemini for incident narration)
- **OR-Tools Python Service** (for advanced route optimization; fallback to greedy algorithm)

## Project Structure

```
backend/
├── src/
│   ├── auth/                      # JWT authentication & RBAC
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.module.ts
│   │   └── dto/
│   ├── fleet/                     # Fleet management
│   │   ├── fleet.controller.ts
│   │   ├── fleet.service.ts
│   │   ├── fleet.entity.ts
│   │   └── fleet.module.ts
│   ├── destination/               # Destination management (TPA, RDF, TPS_3R)
│   │   ├── destination.controller.ts
│   │   ├── destination.service.ts
│   │   ├── destination.entity.ts
│   │   └── destination.module.ts
│   ├── telemetry/                 # Real-time telemetry & anomaly detection
│   │   ├── telemetry.service.ts
│   │   ├── telemetry.entity.ts
│   │   ├── telemetry.module.ts
│   │   └── schemas/
│   ├── recovery/                  # Swarm recovery logic (<60s SLA)
│   │   ├── recovery.service.ts
│   │   ├── recovery.entity.ts
│   │   └── recovery.module.ts
│   ├── optimization/              # Route optimization orchestration
│   │   ├── optimization.service.ts
│   │   ├── optimization.module.ts
│   │   └── schemas/
│   ├── maps/                      # Mapbox integration
│   │   ├── maps-client.service.ts
│   │   └── maps-client.module.ts
│   ├── llm/                       # LLM integration (async)
│   │   ├── llm-engine.service.ts
│   │   └── llm-engine.module.ts
│   ├── dashboard/                 # Dashboard API
│   │   ├── dashboard.controller.ts
│   │   ├── dashboard.service.ts
│   │   └── dashboard.module.ts
│   ├── mqtt/                      # MQTT client
│   │   ├── mqtt.module.ts
│   │   ├── mqtt.controller.ts
│   │   └── schemas/
│   ├── health/                    # Health checks
│   │   ├── health.controller.ts
│   │   └── health.module.ts
│   ├── database/                  # Database setup & migrations
│   │   ├── database.module.ts
│   │   └── migrations/
│   │       ├── 0001_init_schema.sql
│   │       └── 0002_seed_admin.sql
│   ├── common/                    # Shared utilities
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── decorators/
│   │   ├── pipes/
│   │   ├── constant/
│   │   └── types.ts
│   ├── config/                    # Configuration management
│   │   └── configuration.ts
│   ├── app.module.ts              # Root module
│   ├── app.service.ts
│   ├── app.controller.ts
│   └── main.ts                    # Bootstrap
├── test/
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
├── docs/                          # Architecture & planning docs
├── .dockerignore
├── Dockerfile                     # Multi-stage production build
├── docker-compose.yml             # Local dev environment
├── docker-compose.prod.yml        # Production environment
├── package.json
├── tsconfig.json
├── nest-cli.json
├── eslint.config.mjs
└── README.md
```

## Local Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
# Edit .env with your local settings
```

### 4. Start PostgreSQL (if not running via Docker)

```bash
docker run -d \
  --name argus-postgres \
  -e POSTGRES_USER=argus \
  -e POSTGRES_PASSWORD=argus \
  -e POSTGRES_DB=argus \
  -p 5432:5432 \
  postgres:16-alpine
```

Enable TimescaleDB extension:

```bash
docker exec argus-postgres psql -U argus -d argus -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
```

### 5. Start MQTT Broker

```bash
docker run -d \
  --name argus-mqtt \
  -p 1883:1883 \
  -p 9001:9001 \
  eclipse-mosquitto:latest
```

### 6. Run Database Migrations

```bash
npm run migration:run
```

This runs the SQL migrations in order:

1. `src/database/migrations/0001_init_schema.sql`
2. `src/database/migrations/0002_seed_admin.sql`
3. `src/database/migrations/0003_devices_and.sql`

### 7. Start Development Server

```bash
npm run start:dev
```

The API will be available at `http://localhost:3001`
Swagger docs at `http://localhost:3001/api/docs`

## Environment Variables

### Application Core

```
NODE_ENV=development                           # development, staging, production
PORT=3001                                      # HTTP server port
FRONTEND_URL=http://localhost:3000             # CORS origin
```

### Database

```
DATABASE_URL=postgresql://argus:argus@localhost:5432/argus
DB_POOL_SIZE=10                                # TypeORM connection pool
```

### JWT Authentication

```
JWT_SECRET=your-secret-key-min-32-chars       # CHANGE IN PRODUCTION!
JWT_EXPIRES_IN=8h                              # JWT token expiration
```

### MQTT Configuration

```
MQTT_BROKER_URL=mqtt://localhost:1883         # MQTT broker address (supports mqtt://, mqtts://)
MQTT_USERNAME=                                 # Optional: MQTT broker username
MQTT_PASSWORD=                                 # Optional: MQTT broker password
MQTT_TELEMETRY_TOPIC=fleet/+/telemetry        # Topic pattern for device telemetry
MQTT_RECONNECT_PERIOD_MS=5000                 # Reconnection interval (ms)
MQTT_CONNECT_TIMEOUT_MS=10000                 # Connection timeout (ms)
```

### Mapbox Integration

```
MAPBOX_API_KEY=your-mapbox-api-key            # Mapbox Directions API key
MAPBOX_TIMEOUT_MS=10000                       # API timeout (ms)
```

### LLM Integration (Incident Narration)

```
LLM_PROVIDER_API_KEY=your-api-key             # Groq or Gemini API key
LLM_PROVIDER_URL=https://api.groq.com/openai/v1/chat/completions
LLM_PROVIDER_MODEL=llama-3.3-70b-versatile    # Model identifier
LLM_PROVIDER_TIMEOUT_MS=15000                 # API timeout (ms)
```

### Route Optimization Engine

```
OPTIMIZATION_ENGINE_URL=http://localhost:8001 # Python OR-Tools service URL
OPTIMIZATION_ENGINE_TIMEOUT_MS=20000          # Optimization timeout (ms)
SWARM_RECOVERY_TARGET_MS=60000                # Swarm recovery SLA (ms)
SWARM_RECOVERY_OPT_TIMEOUT_MS=15000           # Recovery optimization timeout (ms)
```

### Fleet Monitoring

```
STALE_THRESHOLD_SECONDS=180                   # No telemetry = stale (s)
OFFLINE_THRESHOLD_SECONDS=600                 # Stale → offline (s)
WATCHDOG_INTERVAL_SECONDS=60                  # Status check interval (s)
```

### Telemetry Retention

```
TELEMETRY_COMPRESS_AFTER_DAYS=7               # Compress old data
TELEMETRY_DROP_AFTER_DAYS=90                  # Drop data after (days)
```

### Volume Anomaly Detection

```
LOW_VOLUME_THRESHOLD=0.20                     # 20% volume = anomaly
MOVING_AVERAGE_WINDOW_DAYS=7                  # Anomaly detection window (days)
```

## Docker Deployment

### Development Environment

Start all services locally with Docker Compose:

```bash
docker-compose up -d
```

Services:
- **backend**: NestJS application on `http://localhost:3001`
- **postgres**: PostgreSQL database
- **mqtt**: MQTT broker
- **timescaledb extension**: Automatically enabled

View logs:

```bash
docker-compose logs -f backend
```

Stop services:

```bash
docker-compose down
```

### Production Environment

Build multi-stage image:

```bash
docker build -t argus-backend:latest .
```

Run with environment variables:

```bash
docker run -d \
  --name argus-backend \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://argus:password@db-host:5432/argus" \
  -e MQTT_BROKER_URL="mqtts://mqtt-host:8883" \
  -e JWT_SECRET="your-production-secret-key" \
  argus-backend:latest
```

Or use `docker-compose.prod.yml`:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Dockerfile Features

- **Multi-stage build**: Separate build and runtime stages for minimal image size
- **Node Alpine**: ~150MB final image size
- **Non-root user**: Runs as `node` user for security
- **Health check**: Built-in health endpoint monitoring
- **Build caching**: Optimized layer caching for faster builds

Image size: ~150MB | Build time: ~2-3 minutes

## Database Setup

### Initial Setup

1. Connect to PostgreSQL:

```bash
psql postgresql://argus:argus@localhost:5432/argus
```

2. Enable TimescaleDB:

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

3. Run migrations:

```bash
npm run migration:run
```

### Schema Overview

**Core Tables:**

- `fleet` — Vehicle registry (plate, driver, capacity, status)
- `destination` — Pickup/delivery locations (TPA, RDF, TPS_3R)
- `route_plan` — Optimized routes with waypoints
- `telemetry` — Time-series device data (TimescaleDB hypertable)
- `recovery_log` — Swarm recovery incidents
- `users` — Admin/supervisor/driver accounts

**Enums:**

- `hardware_status`: 'normal' | 'broken'
- `operational_status`: 'ONLINE_NORMAL' | 'ONLINE_BROKEN' | 'STALE' | 'OFFLINE'
- `destination_type`: 'TPA' | 'RDF' | 'TPS_3R'
- `route_plan_status`: 'active' | 'done' | 'cancelled'
- `recovery_status`: 'success' | 'no_receiver' | 'fallback_greedy'
- `user_role`: 'admin' | 'supervisor' | 'driver'

### Backup & Restore

Backup:

```bash
docker exec argus-postgres pg_dump -U argus argus > backup.sql
```

Restore:

```bash
docker exec -i argus-postgres psql -U argus argus < backup.sql
```

## Running Tests

### Unit Tests

```bash
npm run test
```

### Unit Tests (Watch Mode)

```bash
npm run test:watch
```

### Test Coverage

```bash
npm run test:cov
```

### End-to-End Tests

```bash
npm run test:e2e
```

Test configuration: `test/jest-e2e.json`

## API Documentation

### Swagger/OpenAPI

Available at `http://localhost:3001/api/docs` after startup.

### Authentication

All endpoints (except `/auth/login`, `/health`) require JWT token:

```bash
Authorization: Bearer <token>
```

### Core Endpoints

**Auth:**
- `POST /auth/login` — Authenticate with credentials
- `POST /auth/refresh` — Refresh JWT token

**Fleet:**
- `GET /fleet` — List all vehicles (admin/supervisor)
- `POST /fleet` — Register new vehicle (admin)
- `PATCH /fleet/:id` — Update vehicle (admin)
- `DELETE /fleet/:id` — Deactivate vehicle (admin)

**Destination:**
- `GET /destination` — List all destinations (admin/supervisor)
- `POST /destination` — Create destination (admin)
- `PATCH /destination/:id` — Update destination (admin)
- `DELETE /destination/:id` — Delete destination (admin)

**Dashboard:**
- `GET /dashboard/fleet-status` — Real-time fleet overview
- `GET /dashboard/recovery-incidents` — Swarm recovery history
- `GET /dashboard/volume-anomalies` — Anomaly alerts
- `GET /dashboard/route/:routeId` — Route details & waypoints

**Health:**
- `GET /health` — Liveness probe
- `GET /health/ready` — Readiness probe

## Modules

### AuthModule

JWT-based authentication with role-based access control.

**Features:**
- Local strategy with bcrypt password hashing
- JWT token generation & validation
- Role-based guards (admin, supervisor, driver)
- Token refresh mechanism

**Services:**
- `AuthService`: Login, refresh, user validation

### FleetModule

Manages vehicle registry, driver assignments, and operational status.

**Features:**
- Vehicle CRUD operations
- Driver assignment
- Capacity tracking
- Hardware status (normal/broken)
- Operational status (ONLINE_NORMAL, ONLINE_BROKEN, STALE, OFFLINE)

**Services:**
- `FleetService`: Fleet repository operations

### TelemetryModule

Ingests real-time device data via MQTT, detects anomalies, and persists to TimescaleDB.

**Features:**
- MQTT message validation & parsing
- Real-time position tracking
- Volume anomaly detection
- Hardware failure detection
- Stale/offline status propagation
- Triggers recovery for broken vehicles

**Services:**
- `TelemetryService`: Ingestion, validation, persistence, anomaly detection

### RecoveryModule

Handles swarm recovery logic for broken vehicles with <60ms response target.

**Features:**
- Multi-vehicle load redistribution
- Real-time optimization via OR-Tools
- Fallback greedy algorithm
- Incident logging with LLM narration
- Status propagation

**Services:**
- `RecoveryService`: Optimization orchestration, incident management

### OptimizationModule

Orchestrates communication with Python OR-Tools service for route optimization.

**Features:**
- VRP (Vehicle Routing Problem) solving
- Multi-destination waypoint optimization
- Timeout handling with graceful fallback
- Distance matrix integration (Mapbox)

**Services:**
- `OptimizationService`: OR-Tools bridge, route planning

### MapsModule

Integrates Mapbox Directions API for real-world distance and duration calculations.

**Features:**
- Distance matrix computation
- Duration-aware routing
- Caching for frequently queried routes
- Timeout handling

**Services:**
- `MapsClientService`: Mapbox API integration

### LlmEngineModule

Provides LLM-powered incident narration (async, non-critical path).

**Features:**
- Incident summary generation
- Groq / Gemini provider support
- Graceful degradation on timeout/failure
- Async processing

**Services:**
- `LlmEngineService`: LLM API integration, prompt management

### DashboardModule

Command center analytics and real-time visualization.

**Features:**
- Fleet status overview
- Route visualization
- Recovery incident history
- Volume anomaly alerts
- Driver-specific telemetry (RBAC)

**Services:**
- `DashboardService`: Analytics, aggregation, filtering

### MqttModule

Manages MQTT client connection and message routing.

**Features:**
- Auto-reconnection
- TLS support
- Per-device authentication
- Topic pattern subscription
- Message validation

**Services:**
- `MqttService`: Client lifecycle, connection management

### HealthModule

Liveness and readiness probes for Kubernetes/Docker orchestration.

**Features:**
- Liveness check
- Readiness check (database, MQTT, optimization engine)
- Health status aggregation

**Services:**
- `HealthService`: Dependency health checks

## Development Workflow

### 1. Code Style

Automatic formatting with Prettier:

```bash
npm run format
```

### 2. Linting

ESLint with Prettier integration:

```bash
npm run lint
```

### 3. Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

Output: `dist/` directory

### 4. Debug Mode

Debug with Chrome DevTools:

```bash
npm run start:debug
```

Then open `chrome://inspect/#devices`

### 5. Generate NestJS Resources

Generate a new module, controller, service:

```bash
nest generate resource shipment
```

This creates:
- `src/shipment/shipment.module.ts`
- `src/shipment/shipment.controller.ts`
- `src/shipment/shipment.service.ts`
- `src/shipment/dto/` (create-shipment.dto.ts, update-shipment.dto.ts)
- `src/shipment/entities/shipment.entity.ts`
- `src/shipment/shipment.controller.spec.ts`

## Production Considerations

### Security

1. **Environment Variables:**
   - Use secrets manager (AWS Secrets Manager, HashiCorp Vault, Docker Secrets)
   - Never commit `.env` files
   - Rotate `JWT_SECRET` periodically

2. **HTTPS/TLS:**
   - Use TLS 1.3+ for all external connections
   - Enable `MQTTS` for MQTT (port 8883)
   - Certificate pinning for external APIs

3. **Database:**
   - Enable PostgreSQL SSL
   - Use strong password (min 32 characters)
   - Regular backups to external storage
   - Enable audit logging

4. **MQTT Broker:**
   - Enable TLS (mqtts://)
   - Per-device credentials
   - Topic ACLs
   - Rate limiting

5. **API Gateway:**
   - Deploy behind reverse proxy (nginx, Kong, Envoy)
   - DDoS mitigation (rate limiting, WAF)
   - Request logging & monitoring

### Monitoring & Logging

1. **Application Monitoring:**
   - Prometheus metrics export
   - Grafana dashboards
   - Real-time alerting (Alertmanager, PagerDuty)

2. **Logging:**
   - Structured JSON logging (Winston, Pino)
   - Log aggregation (ELK, Splunk, Datadog)
   - Audit trails for sensitive operations

3. **Distributed Tracing:**
   - OpenTelemetry integration
   - Jaeger or Zipkin backend

### Performance

1. **Caching:**
   - Redis for fleet status cache (60s TTL)
   - Memcached for query results
   - HTTP caching headers for static responses

2. **Database Optimization:**
   - Connection pooling (PgBouncer, pgpool)
   - Query optimization & indexes
   - TimescaleDB compression policies
   - Read replicas for analytics

3. **Horizontal Scaling:**
   - Stateless API instances
   - Load balancing (round-robin, least connections)
   - Session sharing (Redis, PostgreSQL)
   - Message queue for async tasks (RabbitMQ, Kafka)

### Deployment

1. **Kubernetes:**
   - Dockerfile with minimal image size
   - Resource requests/limits
   - Probes (liveness, readiness)
   - Service mesh (Istio) for traffic management

2. **Infrastructure:**
   - Multi-AZ deployment
   - Auto-scaling based on metrics
   - Blue-green or canary deployments
   - Rollback strategy

3. **CI/CD:**
   - Automated tests on every push
   - Image scanning (vulnerability, size)
   - Gradual rollout with monitoring
   - Automated rollback on failure

### Compliance & Governance

1. **Data Privacy:**
   - Encrypt PII at rest (AES-256)
   - Encrypt in transit (TLS 1.3)
   - Data retention policies
   - GDPR/CCPA compliance

2. **Audit:**
   - User action logging
   - API access logging
   - Change management
   - Incident response procedures

3. **Performance SLAs:**
   - 99.9% uptime target
   - <100ms p95 API latency
   - <60ms swarm recovery response (critical path)
   - <10s database query timeout

## Troubleshooting

### MQTT Connection Fails

```
ERROR [MqttModule] MQTT connection failed
```

**Solution:**
- Check `MQTT_BROKER_URL` (e.g., `mqtt://localhost:1883`)
- Verify MQTT broker is running: `docker ps | grep mqtt`
- Check firewall: `telnet mqtt-host 1883`
- Verify credentials if using `MQTT_USERNAME`/`MQTT_PASSWORD`

### Database Connection Error

```
ERROR [TypeOrmModule] Database connection failed
```

**Solution:**
- Verify `DATABASE_URL`: `psql "$DATABASE_URL"`
- Check PostgreSQL is running: `docker ps | grep postgres`
- Enable TimescaleDB: `psql "$DATABASE_URL" -c "CREATE EXTENSION timescaledb;"`
- Check pool size: increase `DB_POOL_SIZE` if many connections

### Telemetry Not Ingesting

```
WARN [TelemetryService] Invalid payload: missing fleetId
```

**Solution:**
- Verify device is publishing to correct topic: `mosquitto_sub -h localhost -t "fleet/+/telemetry"`
- Check payload format matches schema
- Verify fleet exists in database: `SELECT id FROM fleet;`
- Check `STALE_THRESHOLD_SECONDS` setting

### Recovery Service Timeout

```
ERROR [RecoveryService] Optimization timeout exceeded
```

**Solution:**
- Increase `OPTIMIZATION_ENGINE_TIMEOUT_MS` (default 20000ms)
- Verify OR-Tools service is running
- Check network latency to optimization service
- Reduce problem complexity (fewer destinations, vehicles)

### LLM Integration Failing

```
WARN [LlmEngineService] LLM provider timeout, falling back
```

**Solution:**
- Verify API key: `curl -H "Authorization: Bearer $LLM_PROVIDER_API_KEY" https://api.groq.com/openai/v1/models`
- Increase `LLM_PROVIDER_TIMEOUT_MS`
- Check rate limits
- Verify prompt format

### Out of Memory

```
JavaScript heap out of memory
```

**Solution:**
- Increase Node.js memory: `NODE_OPTIONS="--max-old-space-size=2048" npm run start:prod`
- Reduce connection pool size: `DB_POOL_SIZE=5`
- Check for memory leaks: `node --inspect dist/main.js`
- Implement pagination for large dataset queries

## Support & Contributing

For issues, feature requests, or contributions:

1. Check existing GitHub issues
2. Run tests locally: `npm run test`
3. Follow code style: `npm run lint && npm run format`
4. Include environment details in bug reports

## License

UNLICENSED — Proprietary software
