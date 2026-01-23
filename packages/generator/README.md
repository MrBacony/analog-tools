# @analog-tools/generator

> **Early Development Stage** -- Breaking changes may happen frequently as APIs evolve.

Nx code generators for scaffolding [AnalogJS](https://analogjs.org) libraries, API routes, and authentication setup within an Nx monorepo.

[![npm version](https://img.shields.io/npm/v/@analog-tools/generator.svg)](https://www.npmjs.com/package/@analog-tools/generator)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Table of Contents

- [Installation](#installation)
- [Available Generators](#available-generators)
- [Library Generator](#library-generator)
  - [Usage](#usage)
  - [Options](#options)
  - [Examples](#examples)
  - [Generated Structure](#generated-structure)
  - [Application Integration](#application-integration)
- [API Route Generator](#api-route-generator)
  - [Usage](#usage-1)
  - [Options](#options-1)
  - [Examples](#examples-1)
  - [Dynamic Segments](#dynamic-segments)
- [Init Auth Generator](#init-auth-generator)
  - [Usage](#usage-2)
  - [Options](#options-2)
  - [What It Creates](#what-it-creates)
  - [Post-Generation Steps](#post-generation-steps)
- [Testing](#testing)
- [Related Packages](#related-packages)
- [License](#license)

## Installation

```bash
npm install -D @analog-tools/generator
```

Peer dependency:

```bash
npm install -D @nx/devkit
```

## Available Generators

| Generator | Description |
|-----------|-------------|
| `@analog-tools/generator:library` | Scaffolds an AnalogJS library with optional pages, API routes, content routes, and tRPC |
| `@analog-tools/generator:api-route` | Adds an H3 event handler following AnalogJS file-based routing conventions |
| `@analog-tools/generator:init-auth` | Wires up `@analog-tools/auth` in an AnalogJS application |

## Library Generator

Scaffolds a new AnalogJS library under `libs/` with build configuration, TypeScript paths, and optional features (pages, API routes, tRPC, content routes).

### Usage

```bash
npx nx generate @analog-tools/generator:library --name=my-feature --project=analog-example
```

Interactive mode (prompts for each option):

```bash
npx nx generate @analog-tools/generator:library
```

### Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `name` | `string` | Yes | -- | Library name (used for directory, routes, and TS path alias) |
| `project` | `string` | Yes | -- | Application project to wire the library into |
| `pages` | `boolean` | No | `false` | Generate file-based routing pages |
| `api` | `boolean` | No | `false` | Generate an API route directory with an example handler |
| `contentRoutes` | `boolean` | No | `false` | Generate a markdown content directory |
| `trpc` | `boolean` | No | `false` | Generate tRPC router infrastructure (context, client, routers) |
| `skipExamples` | `boolean` | No | `false` | Skip example files; create empty directories with `.gitkeep` instead |
| `componentPrefix` | `string` | No | `lib` | Angular component selector prefix |
| `patchTailwind` | `boolean` | No | `true` | Add the library's source paths to the application's Tailwind config |

### Examples

Minimal library (components and services only):

```bash
npx nx g @analog-tools/generator:library --name=shared-ui --project=analog-example
```

Library with file-based routing pages:

```bash
npx nx g @analog-tools/generator:library \
  --name=admin-dashboard \
  --project=analog-example \
  --pages=true
```

Library with REST API and tRPC:

```bash
npx nx g @analog-tools/generator:library \
  --name=user-management \
  --project=analog-example \
  --api=true \
  --trpc=true
```

All features enabled, no example files:

```bash
npx nx g @analog-tools/generator:library \
  --name=core-lib \
  --project=analog-example \
  --pages=true \
  --api=true \
  --contentRoutes=true \
  --trpc=true \
  --skipExamples=true
```

### Generated Structure

The output depends on which options are enabled. With all options:

```
libs/my-feature/
├── src/
│   ├── index.ts                           # Public API barrel
│   ├── test-setup.ts                      # Vitest setup
│   ├── models/                            # Data models (example if --api)
│   ├── lib/
│   │   ├── components/                    # Angular components
│   │   ├── pages/                         # Page components (if --pages)
│   │   └── services/                      # Injectable services
│   ├── pages/                             # File-based routes (if --pages)
│   │   └── my-feature/
│   │       ├── my-feature.page.ts         # Default route
│   │       └── (my-feature).page.ts       # Layout route
│   ├── content/                           # Markdown content (if --contentRoutes)
│   │   └── my-feature/
│   │       └── example-post.md
│   └── backend/
│       ├── index.ts                       # Backend barrel (if --api or --trpc)
│       ├── api/routes/api/my-feature/
│       │   ├── hello.ts                   # REST handler (if --api)
│       │   └── trpc/[trpc].ts             # tRPC catch-all (if --trpc)
│       └── trpc/                          # tRPC infrastructure (if --trpc)
│           ├── context.ts
│           ├── trpc.ts
│           ├── trpc-client.ts
│           └── routers/
│               ├── index.ts
│               └── my-feature.ts
├── eslint.config.cjs
├── package.json
├── project.json
├── README.md
├── tsconfig.json
├── tsconfig.lib.json
├── tsconfig.spec.json
└── vite.config.mts
```

### Application Integration

The generator automatically updates the target application:

**Vite config** -- Adds the library's page and API paths to the AnalogJS plugin configuration so Nitro discovers the routes.

**TypeScript paths** -- Registers the library's barrel export in the workspace `tsconfig.base.json`.

**Tailwind** -- Appends the library's `src/` path to the application's Tailwind `content` array (disable with `--patchTailwind=false`).

## API Route Generator

Creates an H3 `defineEventHandler` file in the correct directory for AnalogJS file-based API routing.

### Usage

```bash
npx nx generate @analog-tools/generator:api-route --project=analog-example --route=v1/hello
```

### Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `route` | `string` | Yes | -- | Route path relative to the API directory (e.g., `v1/users` or `v1/users/[id]`) |
| `project` | `string` | Yes | -- | Target project (application or library) |
| `method` | `string` | No | -- | HTTP method for a method-specific handler. One of: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD` |

**Output location:**

- Applications: `<project-root>/src/server/routes/api/<route>.ts`
- Libraries: `<project-root>/src/api/routes/api/<route>.ts`

When `--method` is specified, the filename includes the method suffix (e.g., `users.post.ts`).

### Examples

Generic handler (responds to all HTTP methods):

```bash
npx nx g @analog-tools/generator:api-route \
  --project=analog-example \
  --route=v1/hello
```

Creates `src/server/routes/api/v1/hello.ts`:

```typescript
import { defineEventHandler } from 'h3';

export default defineEventHandler(async () => {
  return {
    status: 'ok',
  };
});
```

Method-specific handler:

```bash
npx nx g @analog-tools/generator:api-route \
  --project=analog-example \
  --route=v1/users \
  --method=POST
```

Creates `src/server/routes/api/v1/users.post.ts`.

Dynamic route parameter:

```bash
npx nx g @analog-tools/generator:api-route \
  --project=analog-example \
  --route=v1/users/[id]
```

Creates `src/server/routes/api/v1/users/[id].ts`.

### Dynamic Segments

Both syntaxes are supported for dynamic parameters:

| Input | Output filename |
|-------|----------------|
| `users/:id` | `users/[id].ts` |
| `users/[id]` | `users/[id].ts` |

Colon syntax (`:id`) is automatically converted to AnalogJS bracket notation (`[id]`).

## Init Auth Generator

Configures `@analog-tools/auth` in an existing AnalogJS application. Only works with application projects (not libraries).

### Usage

```bash
npx nx generate @analog-tools/generator:init-auth --project=my-app
```

### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `project` | `string` | Yes | The application project to configure |

### What It Creates

The generator performs four operations:

1. **Creates `src/auth.config.ts`** -- OAuth/OIDC provider configuration with Redis session storage. Reads credentials from environment variables.

2. **Creates `src/server/middleware/auth.ts`** -- H3 middleware that calls `useAnalogAuth` on every request, protecting all routes not listed in `unprotectedRoutes`.

3. **Updates `src/app/app.config.ts`** -- Adds `provideAuthClient()` to the providers array and `authInterceptor` to the HTTP client interceptors.

4. **Updates `vite.config.ts`** -- Adds `@analog-tools/auth` to `ssr.noExternal` so Vite bundles it for server-side rendering.

The generator also installs `@analog-tools/auth`, `@analog-tools/inject`, `@analog-tools/logger`, and `@analog-tools/session` if they are not already in `package.json`.

**Generated structure:**

```
src/
├── auth.config.ts                    # OAuth provider + session config
├── app/
│   └── app.config.ts                 # Updated with auth providers
└── server/
    └── middleware/
        └── auth.ts                   # Auth middleware
vite.config.ts                         # Updated with ssr.noExternal
```

### Post-Generation Steps

1. **Set environment variables:**

   ```env
   AUTH_ISSUER=https://your-auth-provider.com
   AUTH_CLIENT_ID=your-client-id
   AUTH_CLIENT_SECRET=your-client-secret
   AUTH_AUDIENCE=your-api-audience
   AUTH_SCOPE=openid profile email
   AUTH_CALLBACK_URL=http://localhost:4200/api/auth/callback
   REDIS_URL=redis://localhost:6379
   SESSION_SECRET=your-secure-random-secret
   ```

2. **Start Redis** (default session storage):

   ```bash
   # Docker
   docker run -d -p 6379:6379 redis:alpine

   # macOS
   brew install redis && brew services start redis

   # Ubuntu/Debian
   sudo apt-get install redis-server && sudo systemctl start redis
   ```

3. **Configure unprotected routes** in `auth.config.ts` -- add any public routes that should bypass authentication.

4. **Register your callback URL** with your OAuth provider (must match `AUTH_CALLBACK_URL` exactly).

You can switch from Redis to any other [unstorage driver](https://unstorage.unjs.io/drivers) by modifying the `sessionStorage` block in `auth.config.ts`. See [`@analog-tools/session`](https://github.com/MrBacony/analog-tools/tree/main/packages/session) for supported drivers.

## Testing

```bash
npx nx test @analog-tools/generator
```

Runs the Vitest suite covering all three generators.

## Related Packages

| Package | Purpose |
|---------|---------|
| [`@analog-tools/auth`](https://github.com/MrBacony/analog-tools/tree/main/packages/auth) | OAuth 2.0/OIDC authentication (BFF pattern) |
| [`@analog-tools/session`](https://github.com/MrBacony/analog-tools/tree/main/packages/session) | Session management with unstorage drivers |
| [`@analog-tools/inject`](https://github.com/MrBacony/analog-tools/tree/main/packages/inject) | Service registry dependency injection |
| [`@analog-tools/logger`](https://github.com/MrBacony/analog-tools/tree/main/packages/logger) | Structured logging with deduplication |

## License

MIT
