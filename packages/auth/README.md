# @analog-tools/auth

> **Early Development Stage** - Breaking changes may happen frequently as APIs evolve. Pin to specific versions in production.

OAuth 2.0/OpenID Connect authentication for [AnalogJS](https://analogjs.org) applications using a Backend-for-Frontend (BFF) pattern. Tokens are stored server-side only and never exposed to the browser.

[![npm version](https://img.shields.io/npm/v/@analog-tools/auth.svg)](https://www.npmjs.com/package/@analog-tools/auth)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Table of Contents

- [How It Works](#how-it-works)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [Session Storage](#session-storage)
  - [Route Protection](#route-protection)
  - [File Type Whitelist](#file-type-whitelist)
  - [User Data Handling](#user-data-handling)
- [Built-in Routes](#built-in-routes)
- [Token Refresh](#token-refresh)
- [Angular Client Integration](#angular-client-integration)
  - [Setup](#setup)
  - [AuthService API](#authservice-api)
  - [Route Guards](#route-guards)
  - [tRPC Integration](#trpc-integration)
- [Security](#security)
- [Vite Configuration](#vite-configuration)
- [Troubleshooting](#troubleshooting)
- [Breaking Changes](#breaking-changes)
- [Related Packages](#related-packages)
- [License](#license)

## How It Works

The package implements the BFF authentication pattern:

1. The user clicks "Login" and the browser redirects to `/api/auth/login`
2. The server generates a CSRF state token, stores it in the session, and redirects to the OAuth provider
3. After successful login, the provider redirects back to `/api/auth/callback`
4. The server verifies the state parameter, exchanges the authorization code for tokens, and stores everything in a server-side session
5. The browser receives only an HMAC-SHA256 signed session cookie -- no tokens leave the server

This keeps access tokens, refresh tokens, and ID tokens out of browser storage entirely.

## Installation

```bash
npm install @analog-tools/auth
```

Peer dependencies:

```bash
npm install h3 uncrypto
```

For the Angular client integration, you also need:

```bash
npm install @analogjs/router @angular/core @angular/common @angular/router rxjs
```

## Quick Start

Create a middleware file that runs on every request:

```typescript
// src/server/middleware/auth.ts
import { defineEventHandler, H3Event } from 'h3';
import { useAnalogAuth, AnalogAuthConfig } from '@analog-tools/auth';

const authConfig: AnalogAuthConfig = {
  issuer: process.env['AUTH_ISSUER'] || '',
  clientId: process.env['AUTH_CLIENT_ID'] || '',
  clientSecret: process.env['AUTH_CLIENT_SECRET'] || '',
  scope: 'openid profile email',
  callbackUri: process.env['AUTH_CALLBACK_URL'] || 'http://localhost:3000/api/auth/callback',
  unprotectedRoutes: [
    '/',
    '/api/public/*',
  ],
  whitelistFileTypes: ['.css', '.js', '.png', '.svg', '.ico', '.woff2'],
  sessionStorage: {
    sessionSecret: process.env['SESSION_SECRET'] || 'change-me-in-production',
    ttl: 86400,
    driver: {
      type: 'redis',
      options: {
        url: process.env['REDIS_URL'] || 'redis://localhost:6379',
      },
    },
  },
};

export default defineEventHandler(async (event: H3Event) => {
  return useAnalogAuth(authConfig, event);
});
```

That single middleware registers all auth routes and protects everything not listed in `unprotectedRoutes`.

## Configuration

The `AnalogAuthConfig` type accepts these options:

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `issuer` | `string` | Yes | OAuth/OIDC provider URL (e.g., `https://auth.example.com/realms/my-realm`) |
| `clientId` | `string` | Yes | OAuth client ID |
| `clientSecret` | `string` | Yes | OAuth client secret |
| `callbackUri` | `string` | Yes | Callback URL registered with your provider |
| `scope` | `string` | Yes | OAuth scopes (e.g., `"openid profile email"`) |
| `sessionStorage` | `SessionStorageConfig` | Yes | Session storage configuration (see below) |
| `audience` | `string` | No | API audience identifier (required by some providers like Auth0) |
| `unprotectedRoutes` | `string[]` | No | Routes that bypass authentication |
| `whitelistFileTypes` | `string[]` | No | File extensions that bypass authentication (e.g., `['.css', '.js']`) |
| `tokenRefreshApiKey` | `string` | No | API key for the `/api/auth/refresh-tokens` endpoint |
| `logoutUrl` | `string` | No | URL to redirect to after OAuth provider logout |
| `userHandler` | `UserHandler` | No | Callbacks for user data processing |

### Session Storage

Session storage uses `@analog-tools/session` which wraps [unstorage](https://unstorage.unjs.io/drivers). You must provide a `driver` configuration:

```typescript
sessionStorage: {
  sessionSecret: 'your-secret-key',  // Used for HMAC-SHA256 cookie signing
  ttl: 86400,                         // Session TTL in seconds (default: 24h)
  prefix: 'auth-session',             // Optional key prefix in storage
  driver: {
    type: 'redis',
    options: {
      url: 'redis://localhost:6379',
    },
  },
}
```

**Redis with host/port:**

```typescript
driver: {
  type: 'redis',
  options: {
    host: 'localhost',
    port: 6379,
    password: 'your-password',
    db: 0,
  },
}
```

**Cloudflare KV:**

```typescript
driver: {
  type: 'cloudflare-kv-binding',
  options: {
    binding: 'MY_KV_NAMESPACE',
  },
}
```

**File system (development only):**

```typescript
driver: {
  type: 'fs',
  options: {
    base: './.sessions',
  },
}
```

Any [unstorage driver](https://unstorage.unjs.io/drivers) works here. See `@analog-tools/session` for the full list.

> **Note:** Memory storage (`type: 'memory'`) is currently non-functional. Use Redis, Cloudflare KV, or file system instead.

### Route Protection

The `unprotectedRoutes` array supports exact matches and wildcard patterns:

```typescript
unprotectedRoutes: [
  '/',              // Exact match (with or without trailing slash)
  '/login',         // Exact match
  '/api/public/*',  // Wildcard: matches /api/public/anything but NOT /api/public or /api/public/
  '/docs/*',        // Wildcard: matches /docs/getting-started, /docs/api/auth, etc.
]
```

**Matching rules:**

| Pattern | Path | Matches? | Reason |
|---------|------|----------|--------|
| `'/'` | `/` | Yes | Exact match |
| `'/'` | `/home` | No | Not exact |
| `'/api/public'` | `/api/public` | Yes | Exact match |
| `'/api/public'` | `/api/public/` | Yes | Trailing slash normalized |
| `'/api/public'` | `/api/public/data` | No | Not exact |
| `'/api/public/*'` | `/api/public` | No | Wildcard requires content after prefix |
| `'/api/public/*'` | `/api/public/` | No | Only trailing slash, no content |
| `'/api/public/*'` | `/api/public/data` | Yes | Has content after prefix |

All routes not listed in `unprotectedRoutes` require a valid session. Unauthenticated browser requests get redirected to `/api/auth/login`. API requests (with `fetch: 'true'` header) receive a 401 response.

### File Type Whitelist

Static assets typically don't need authentication checks. Use `whitelistFileTypes` to skip auth for requests matching file extensions:

```typescript
whitelistFileTypes: ['.css', '.js', '.png', '.svg', '.ico', '.woff2', '.jpg']
```

Extensions are normalized (case-insensitive, leading dot optional). This check runs before route matching, so it's efficient for high-traffic static asset requests.

### User Data Handling

The optional `userHandler` lets you customize what gets stored in the session after authentication:

```typescript
userHandler: {
  // Called after token exchange - persist user to your database
  createOrUpdateUser: async (userInfo) => {
    const user = await db.users.upsert({
      where: { sub: userInfo.sub },
      update: { lastLogin: new Date() },
      create: { sub: userInfo.sub, name: userInfo.name, email: userInfo.email },
    });
    return user;  // This object is stored as session.user
  },

  // Called when reading user from session - transform for your app's needs
  mapUserToLocal: (userInfo) => ({
    id: userInfo.sub,
    name: userInfo.name,
    email: userInfo.email,
    roles: userInfo.realm_access?.roles || [],
  }),
}
```

## Built-in Routes

The middleware automatically registers these routes under `/api/auth/`:

| Route | Method | Auth Required | Description |
|-------|--------|---------------|-------------|
| `/api/auth/login` | GET | No | Redirects to OAuth provider. Accepts `?redirect_uri=` for post-login redirect. |
| `/api/auth/callback` | GET | No | Handles OAuth provider callback, exchanges code for tokens. |
| `/api/auth/logout` | GET | No | Revokes tokens, clears session, redirects to provider logout. |
| `/api/auth/authenticated` | GET | No | Returns `{ authenticated: boolean }`. |
| `/api/auth/user` | GET | Yes | Returns the authenticated user object. |
| `/api/auth/refresh-tokens` | GET | No* | Bulk refresh of expiring tokens. Requires `Authorization: Bearer <tokenRefreshApiKey>` header. |

*The refresh-tokens endpoint uses API key auth rather than session auth.

## Token Refresh

The package implements three refresh strategies:

**1. Lazy refresh** -- When a request arrives with an expired token, the middleware attempts a refresh before returning 401.

**2. Proactive refresh** -- If a token is within 5 minutes of expiry (`TOKEN_REFRESH_SAFETY_MARGIN = 300`), a background refresh fires without blocking the current request.

**3. Scheduled refresh** -- For production, configure a CRON job to hit the bulk refresh endpoint:

```bash
# Every 4 minutes, refresh tokens expiring in the next 5 minutes
curl -X GET https://your-app.com/api/auth/refresh-tokens \
  -H "Authorization: Bearer YOUR_TOKEN_REFRESH_API_KEY"
```

The endpoint iterates all active sessions, refreshes tokens within the safety margin, and returns:

```json
{ "success": true, "refreshed": 12, "failed": 0, "total": 45 }
```

Set the `tokenRefreshApiKey` in your config to secure this endpoint.

## Angular Client Integration

The `@analog-tools/auth/angular` entry point provides Angular services for the client side of the BFF pattern. It communicates with the server-side auth routes to determine authentication state.

### Setup

```typescript
// src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideFileRouter } from '@analogjs/router';
import { provideAuthClient, authInterceptor } from '@analog-tools/auth/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideFileRouter(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAuthClient(),
  ],
};
```

The `authInterceptor` does two things:
- Adds a `fetch: 'true'` header to requests so the server returns 401 instead of redirecting
- Catches 401 responses and redirects the browser to `/api/auth/login`

### AuthService API

```typescript
import { Component, inject } from '@angular/core';
import { AuthService } from '@analog-tools/auth/angular';

@Component({
  standalone: true,
  template: `
    @if (auth.isAuthenticated()) {
      <p>Hello, {{ auth.user()?.fullName }}</p>
      <button (click)="auth.logout()">Logout</button>
    } @else {
      <button (click)="auth.login()">Login</button>
    }
  `,
})
export default class HomePage {
  auth = inject(AuthService);
}
```

**Signals:**

| Signal | Type | Description |
|--------|------|-------------|
| `isAuthenticated` | `Signal<boolean>` | `true` when the server confirms a valid session. Polls every 5 minutes. |
| `user` | `Signal<AuthUser \| null>` | User profile fetched from `/api/auth/user` when authenticated. |

**Methods:**

| Method | Description |
|--------|-------------|
| `login(targetUrl?: string)` | Redirects browser to `/api/auth/login`. Pass a URL to return to after auth. |
| `logout()` | Redirects browser to `/api/auth/logout`. |
| `hasRoles(roles: string[])` | Returns `true` if the user has any of the specified roles. |

**`AuthUser` shape:**

```typescript
interface AuthUser {
  username: string;
  fullName: string;
  givenName: string;
  familyName: string;
  picture?: string;
  email?: string;
  emailVerified?: boolean;
  locale?: string;
  roles?: string[];
}
```

The `AuthService` automatically transforms provider-specific user data (Auth0, Keycloak, generic OIDC) into this normalized format.

### Route Guards

```typescript
// Require authentication
import { authGuard } from '@analog-tools/auth/angular';

export const routeMeta = {
  canActivate: [authGuard],
};
```

```typescript
// Require specific roles
import { roleGuard } from '@analog-tools/auth/angular';

export const routeMeta = {
  canActivate: [roleGuard],
  data: {
    roles: ['admin', 'editor'],  // User needs at least one of these
  },
};
```

The `authGuard` redirects to login if unauthenticated. The `roleGuard` redirects to `/access-denied` if the user lacks the required roles.

### tRPC Integration

The package provides `createTrpcClientWithAuth` to forward session cookies through tRPC calls:

```typescript
// src/trpc-client.ts
import { createTrpcClient } from '@analogjs/trpc';
import { inject } from '@angular/core';
import { injectRequest } from '@analogjs/router/tokens';
import { createTrpcClientWithAuth } from '@analog-tools/auth/angular';
import { AppRouter } from './server/trpc/routers';

export const { provideTrpcClient, TrpcClient, TrpcHeaders } =
  createTrpcClient<AppRouter>({
    url: '/api/trpc',
  });

export function injectTrpcClient() {
  return createTrpcClientWithAuth(inject(TrpcClient), injectRequest(), TrpcHeaders);
}
```

On the server side, use `checkAuthentication` in a tRPC middleware:

```typescript
// src/server/trpc/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server';
import { checkAuthentication } from '@analog-tools/auth';

const t = initTRPC.context<{ event: H3Event }>().create();

const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!(await checkAuthentication(ctx.event))) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx });
});

export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthenticated);
```

## Security

**What the package handles:**
- Tokens stored server-side only (BFF pattern)
- HMAC-SHA256 signed session cookies via `uncrypto`
- CSRF protection via OAuth `state` parameter (UUID generated per login, validated on callback)
- `httpOnly`, `secure`, `sameSite: 'lax'` cookies (secure flags enabled when `NODE_ENV=production`)
- Token revocation on logout (both access and refresh tokens)
- Retry logic with exponential backoff for provider communication failures

**Production checklist:**
- Set `NODE_ENV=production` for secure cookie defaults
- Use a strong random `sessionSecret` (at least 32 characters)
- Use persistent storage (Redis, Cloudflare KV) -- not memory or filesystem
- Configure `tokenRefreshApiKey` and set up a CRON job for scheduled token refresh
- Set up HTTPS (required for `secure` cookies)
- Add rate limiting to auth endpoints in your infrastructure

## Vite Configuration

Add the package to `ssr.noExternal` so Vite bundles it for SSR:

```typescript
// vite.config.ts
import analog from '@analogjs/platform';
import { defineConfig } from 'vite';

export default defineConfig({
  ssr: {
    noExternal: ['@analog-tools/**'],
  },
});
```

## Troubleshooting

**"Failed to fetch OpenID configuration"**
- Verify the `issuer` URL is correct and reachable from your server
- The package fetches `{issuer}/.well-known/openid-configuration` and caches it for 1 hour

**"Failed to exchange authorization code"**
- Check that `callbackUri` exactly matches what's registered with your OAuth provider (including protocol and port)
- Verify `clientId` and `clientSecret` are correct

**"Invalid or missing state parameter"**
- The session may have expired between the login redirect and the callback
- Check that your session storage is working (Redis connection, KV binding, etc.)

**401 on routes that should be unprotected**
- Wildcard patterns (`/api/public/*`) require actual path content after the prefix
- `/api/public/` alone does not match -- there must be something after the slash

**Angular AuthService shows `isAuthenticated = false` after login**
- Ensure `provideAuthClient()` is in your app config
- Check that the `authInterceptor` is registered
- Verify the server is responding to `/api/auth/authenticated` with `{ authenticated: true }`

## Breaking Changes

### v0.0.12 - Session Storage Configuration

The `sessionStorage` config switched from a `type`/`config` pattern to a `driver`-based approach:

**Before:**
```typescript
sessionStorage: {
  type: 'redis',
  config: {
    host: 'localhost',
    port: 6379,
    password: 'your-password',
    sessionSecret: 'your-secret',
    maxAge: 86400,
  },
}
```

**After:**
```typescript
sessionStorage: {
  sessionSecret: 'your-secret',
  ttl: 86400,
  driver: {
    type: 'redis',
    options: {
      host: 'localhost',
      port: 6379,
      password: 'your-password',
    },
  },
}
```

See `@analog-tools/session` for all supported driver types.

## Related Packages

| Package | Purpose |
|---------|---------|
| [`@analog-tools/session`](https://github.com/MrBacony/analog-tools/tree/main/packages/session) | Session storage with unstorage drivers |
| [`@analog-tools/inject`](https://github.com/MrBacony/analog-tools/tree/main/packages/inject) | Service registry DI |
| [`@analog-tools/logger`](https://github.com/MrBacony/analog-tools/tree/main/packages/logger) | Structured logging |

## License

MIT
