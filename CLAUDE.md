# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

analog-tools is a collection of utilities and libraries for [AnalogJS](https://analogjs.org) fullstack meta-framework applications. The project is an Nx monorepo providing authentication, session management, logging, and dependency injection capabilities.

**⚠️ Early Development Stage**: Breaking changes may happen frequently as APIs evolve.

## Available Packages

- `@analog-tools/auth` - OAuth 2.0/OIDC authentication for server-side (h3/Nitro)
- `@analog-tools/auth-angular` - Angular client-side authentication components and services
- `@analog-tools/session` - Session management with pluggable storage backends
- `@analog-tools/inject` - Custom dependency injection framework
- `@analog-tools/logger` - Structured logging with deduplication
- `@analog-tools/generator` - Nx code generators for scaffolding

## Common Commands

### Development

```bash
# Serve the example application
npx nx serve analog-example

# Build a specific package
npx nx build @analog-tools/auth
npx nx build @analog-tools/session

# Build all packages
npx nx run-many -t build
```

### Testing

```bash
# Test a specific package
npx nx test @analog-tools/auth
npx nx test @analog-tools/session

# Test with coverage
npx nx test @analog-tools/logger --coverage

# Run all tests
npx nx run-many -t test
```

### Package Management

```bash
# Create a package tarball for local testing
npx nx pack @analog-tools/auth

# Release workflow (versions and publishes)
npx nx release
```

## Architecture

### Package Relationships

```
@analog-tools/auth (server)
    ├── @analog-tools/session
    ├── @analog-tools/inject
    └── @analog-tools/logger

@analog-tools/auth-angular (client)
    └── integrates with @analog-tools/auth

@analog-tools/session
    └── @analog-tools/inject

@analog-tools/logger
    └── @analog-tools/inject
```

### Custom Dependency Injection System

Location: `/packages/inject/src`

The project uses a custom DI system based on a service registry pattern:

- Services must be marked with `static readonly INJECTABLE = true`
- Use `registerService(TokenClass, ...constructorArgs)` to register
- Use `inject(TokenClass)` to retrieve instances
- Singleton pattern: one instance per token
- No decorators or metadata reflection

```typescript
// Mark a service as injectable
class MyService {
  static readonly INJECTABLE = true;
  constructor(config: Config) {}
}

// Register with arguments
registerService(MyService, configObject);

// Inject anywhere
const service = inject(MyService);
```

### Authentication Architecture (BFF Pattern)

Location: `/packages/auth/src/server`

Implements Backend-for-Frontend OAuth 2.0/OIDC authentication:

**Key Components:**
- `useAnalogAuth()` - Initializes auth system and returns route handler
- `OAuthAuthenticationService` - Core OAuth logic (token exchange, refresh, validation)
- `SessionService` - Manages auth sessions via `@analog-tools/session`

**Routes** (exposed via middleware):
- `POST /login` - Initiates OAuth flow
- `GET /callback` - OAuth provider callback handler
- `POST /logout` - Revokes tokens and clears session
- `GET /authenticated` - Checks auth status
- `GET /user` - Returns current user

**Security:**
- Tokens stored server-side only (never exposed to client)
- HMAC-SHA256 signed session cookies
- Token refresh with 5-minute safety margin
- CSRF protection via OAuth state parameter
- Configurable unprotected routes with wildcard support

**Configuration** (`AnalogAuthConfig`):
```typescript
{
  issuer: string;              // OAuth provider URL
  clientId: string;
  clientSecret: string;
  scope: string;               // e.g., "openid profile email"
  callbackUri: string;
  unprotectedRoutes?: string[]; // ['/', '/login', '/api/public/*']
  whitelistFileTypes?: string[]; // ['.css', '.js', '.png']
  sessionStorage: {
    driver: { type: 'redis' | 'cloudflare-kv-binding' | 'fs' | 'memory' }
  }
}
```

### Session Management (Functional API)

Location: `/packages/session/src`

Functional API redesigned in v0.0.6 for simplicity:

```typescript
// Initialize session
await useSession(event, {
  store,           // unstorage Storage instance
  secret,          // String or array for rotation
  name,            // Cookie name
  maxAge,          // TTL in seconds
  cookie: { ... }  // Cookie options
});

// API functions
getSession<T>(event): T | null
updateSession<T>(event, updater: (current) => Partial<T>)
destroySession(event)
regenerateSession(event)
```

**Storage:**
- Direct unstorage integration (no wrapper abstractions)
- Use `createUnstorageStore(driver)` factory
- Supports: Redis, Cloudflare KV, file system, MongoDB, etc.
- Memory driver currently has issues

### Angular Client Integration

Location: `/packages/auth-angular/src`

Uses Angular 19+ signals and modern patterns:

- `AuthService` - Provides reactive auth state
  - `isAuthenticated()` signal
  - `user()` signal with automatic type transformation
  - `login(targetUrl)` and `logout()` methods
- `authGuard` - Route guard for protected routes
- `roleGuard` - Route guard for role-based access
- `authInterceptor` - HTTP interceptor for request context
- tRPC integration via `createTrpcClientWithAuth()`

### Logger Architecture

Location: `/packages/logger/src`

Structured logging with deduplication:

- `LoggerService` - Main logging class (injectable)
  - `forContext(name)` - Create child logger with context
  - Levels: DEBUG, INFO, WARN, ERROR, CRITICAL
- `LogDeduplicator` - Prevents message spam
- `ErrorSerializer` - Converts errors to structured format
- Nitro/H3 integration with type-safe event validation

## Build System

- **Build tool:** Vite with Nx integration
- **Output formats:** ESM (`index.js`) and CommonJS (`index.cjs`)
- **Multi-entry packages:** `@analog-tools/auth` exports both `.` and `./angular`
- **Type declarations:** Generated via `vite-plugin-dts`

**Special build process for auth package:**
1. Build `@analog-tools/auth-angular` (client components)
2. Build `@analog-tools/auth` (server functions)
3. Copy auth-angular output to `auth/angular/` subdirectory
4. Update package.json exports via `tools/update-package-json.js`

## Testing

- **Framework:** Vitest with `@analogjs/vitest-angular` plugin
- **Location:** Co-located `.spec.ts` files and `src/__tests__/` directories
- **Coverage:** Run with `--coverage` flag

## File Naming Conventions

- Components: `feature-name.component.ts`
- Services: `feature-name.service.ts`
- Pages (AnalogJS): `route-name.page.ts` (default export)
- API Routes: `endpoint-name.ts` in `server/routes/api/`
- Tests: `*.spec.ts`
- All files: kebab-case

## Key Implementation Details

### Route Protection

Unprotected routes support exact matches and wildcards:
```typescript
unprotectedRoutes: [
  '/',                    // Exact: / and /
  '/login',              // Exact: /login and /login/
  '/api/public/*',       // Wildcard: /api/public/anything
]
```

File type whitelist for static assets:
```typescript
whitelistFileTypes: ['.css', '.js', '.png', '.svg', '.ico']
```

### Token Refresh

Token refresh strategies:
1. **Lazy refresh:** On access if expired
2. **Proactive refresh:** Background refresh 5 minutes before expiry
3. **Scheduled refresh:** CRON job via `refreshExpiringTokens()`

Safety margin: `TOKEN_REFRESH_SAFETY_MARGIN = 300` (5 minutes)

### OpenID Configuration Caching

- Fetches from `{issuer}/.well-known/openid-configuration`
- TTL: 1 hour
- Cached in `OAuthAuthenticationService`

### Error Handling

Session errors:
```typescript
type SessionError = {
  code: 'COOKIE_ERROR' | 'INVALID_SESSION' | 'CRYPTO_ERROR' | 'STORAGE_ERROR' | 'EXPIRED_SESSION';
  message: string;
  details?: Record<string, unknown>;
}
```

Auth errors use H3 `createError()` with automatic retry logic for network failures.

## Angular & AnalogJS Conventions

Per `.github/copilot-instructions.md`, this project follows:

- **Angular 19+:** Signals, standalone components, control flow (`@if`, `@for`)
- **Modern inputs:** Use `input()` and `input.required()`, not `@Input()`
- **Dependency injection:** Prefer `inject()` over constructor injection
- **Tailwind CSS:** Primary styling approach
- **Type safety:** Strict TypeScript, no `any` types

## Security Considerations

1. Never expose OAuth tokens to client
2. Use persistent session storage (Redis, KV) in production, not memory
3. Session secret rotation supported via array of secrets
4. Secure cookies: httpOnly, secure, sameSite configured
5. HTTPS required in production
6. Rate limiting recommended for auth endpoints

## Example Application

Location: `/apps/analog-example`

Demonstrates full integration of all packages:
- Auth configuration in `src/auth.config.ts`
- Middleware setup in `src/server/middleware/auth.ts`
- Protected and unprotected routes
- Angular components using AuthService

## Recent Changes

**Current branch (`whitelist_filetypes`):**
- Added `whitelistFileTypes` configuration
- File extension-based unprotected route matching

**Session redesign (v0.0.6):**
- Simplified to functional API
- Removed overengineered abstractions
- Direct unstorage integration
