# Analog Auth Demo

Demo app for `@analog-tools/auth` integration with AnalogJS, used for E2E testing of auth flows.

## Prerequisites

- Docker (for Keycloak)
- Node.js 18+
- `SESSION_SECRET` environment variable set

## Quick Start

```bash
# 1. Start Keycloak
docker compose -f docker/docker-compose.yml up -d

# 2. Copy env vars
cp apps/analog-demo-auth/.env.example apps/analog-demo-auth/.env.local

# 3. Serve the app (port 4201)
pnpm nx serve analog-demo-auth

# 4. Open http://localhost:4201
```

## Test User

- Username: `testuser`
- Password: `test123`

## Routes

| Route | Auth | Description |
|-------|------|-------------|
| `/` | Public | Home page with navigation |
| `/info` | Public | Info page |
| `/dashboard` | Protected | Shows user info after login |
| `/api/v1/health` | Public | Health check endpoint |
| `/api/v1/me` | Protected | Returns authenticated user |

## E2E Tests

```bash
# Requires Keycloak running
pnpm nx e2e analog-demo-auth-e2e
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_ISSUER` | Yes | Keycloak realm URL |
| `AUTH_CLIENT_ID` | Yes | OAuth client ID |
| `AUTH_CLIENT_SECRET` | Yes | OAuth client secret |
| `SESSION_SECRET` | Yes | Session signing secret |
| `AUTH_CALLBACK_URL` | No | Defaults to `http://localhost:4201/api/auth/callback` |

## Troubleshooting

- **`SESSION_SECRET` error**: Set the env var or copy `.env.example` to `.env.local`
- **Keycloak unreachable**: Run `docker compose -f docker/docker-compose.yml up -d` and wait ~30s
- **`invalid_grant`**: Delete `.sessions/` directory and try again
