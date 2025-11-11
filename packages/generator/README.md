# Analog Tools Generators

Custom Nx generators that scaffold AnalogJS projects with consistent
file-based routing, API handlers, and supporting configuration.

## Available Generators

- `@analog-tools/generator:library` – creates a feature-complete AnalogJS library with optional pages, content routes, REST endpoints, and tRPC support.
- `@analog-tools/generator:api-route` – adds a new API handler to an application or library following AnalogJS routing conventions.
- `@analog-tools/generator:init-auth` – initializes authentication setup for an AnalogJS application using `@analog-tools/auth`.

## Library Generator

### Usage

```bash
npx nx generate @analog-tools/generator:library --name=my-feature --project=analog-example
```

Or using the Nx Console UI:

```bash
npx nx generate @analog-tools/generator:library
```

### What it does

Creates a fully-featured AnalogJS library with configurable options for pages, API routes, content, and tRPC integration. The generator scaffolds a complete library structure with:

- Base TypeScript configuration and build setup
- ESLint configuration
- Vite configuration for AnalogJS
- Optional file-based routing pages
- Optional API route handlers
- Optional markdown content routes
- Optional tRPC router infrastructure
- Optional example files (components, models, pages)
- Automatic Tailwind CSS integration

### Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `name` | `string` | Yes | - | Library name (e.g., `my-feature`) |
| `project` | `string` | Yes | - | Application project to add the library to |
| `pages` | `boolean` | No | - | Include file-based routing pages |
| `api` | `boolean` | No | - | Include API routes |
| `contentRoutes` | `boolean` | No | - | Include markdown content routes |
| `trpc` | `boolean` | No | - | Include tRPC router infrastructure |
| `skipExamples` | `boolean` | No | `false` | Skip generating example files |
| `componentPrefix` | `string` | No | `lib` | Prefix for component selectors |
| `patchTailwind` | `boolean` | No | `true` | Update Tailwind config to include library sources |

### Examples

**Basic library (no pages or API):**
```bash
npx nx g @analog-tools/generator:library --name=shared-ui --project=analog-example
```

**Library with pages:**
```bash
npx nx g @analog-tools/generator:library \
  --name=admin-dashboard \
  --project=analog-example \
  --pages=true
```

**Full-featured library with everything:**
```bash
npx nx g @analog-tools/generator:library \
  --name=user-management \
  --project=analog-example \
  --pages=true \
  --api=true \
  --contentRoutes=true \
  --trpc=true
```

**Library without examples:**
```bash
npx nx g @analog-tools/generator:library \
  --name=core-lib \
  --project=analog-example \
  --skipExamples=true
```

### Generated Structure

The generator creates a library structure under `libs/<name>/` with the following structure based on your options:

```
libs/my-feature/
├── src/
│   ├── index.ts                           # Public API exports
│   ├── test-setup.ts                      # Test configuration
│   ├── lib/                               # Components and services (always)
│   │   └── pages/                         # Page components (if --pages)
│   ├── pages/                             # File-based routes (if --pages)
│   │   └── my-feature/
│   │       ├── my-feature.page.ts
│   │       └── (my-feature).page.ts
│   ├── content/                           # Markdown content (if --contentRoutes)
│   │   └── my-feature/
│   │       └── example-post.md
│   └── backend/                           # Backend infrastructure
│       ├── api/
│       │   └── routes/
│       │       └── api/
│       │           └── my-feature/
│       │               ├── hello.ts       # REST API (if --api)
│       │               └── trpc/
│       │                   └── [trpc].ts  # tRPC handler (if --trpc)
│       ├── index.ts                       # Backend exports (if --api)
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

### Integration with Application

**Pages:** If `--pages` is enabled, pages are automatically registered via AnalogJS file-based routing when the library is imported in the app's routes.

**API Routes:** If `--api` or `--trpc` is enabled, the backend handlers are automatically discovered by Nitro when placed in the correct directory structure.

**Tailwind:** The generator automatically patches the application's Tailwind configuration to include the library's source files (unless `--patchTailwind=false`).

## API Route Generator

### Usage

```bash
npx nx generate @analog-tools/generator:api-route --project=analog-example --route=v1/hello
```

Or using the Nx Console UI:

```bash
npx nx generate @analog-tools/generator:api-route
```

### What it does

Creates an AnalogJS API route handler following file-based routing conventions. The generator creates a handler file in the appropriate location with a ready-to-use `defineEventHandler` stub.

**For applications:** Routes are created under `src/server/routes/api/`
**For libraries:** Routes are created under `src/backend/api/routes/api/`

### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `route` | `string` | Yes | Route path relative to API directory (e.g., `v1/users` or `v1/users/[id]`) |
| `project` | `string` | Yes | Project where the API route should be added |
| `method` | `string` | No | HTTP method for method-specific handler (leave empty for generic handler) |

### Examples

**Generic handler (handles all methods):**
```bash
npx nx g @analog-tools/generator:api-route \
  --project=analog-example \
  --route=v1/hello
```
Creates: `src/server/routes/api/v1/hello.ts`

**Method-specific handler:**
```bash
npx nx g @analog-tools/generator:api-route \
  --project=analog-example \
  --route=v1/users \
  --method=POST
```
Creates: `src/server/routes/api/v1/users.post.ts`

**Dynamic route segments:**
```bash
npx nx g @analog-tools/generator:api-route \
  --project=analog-example \
  --route=v1/users/[id]
```
Creates: `src/server/routes/api/v1/users/[id].ts`

**Library API route:**
```bash
npx nx g @analog-tools/generator:api-route \
  --project=user-management \
  --route=users/[id]
```
Creates: `libs/user-management/src/backend/api/routes/api/users/[id].ts`

### Method-specific Handlers

Supported HTTP methods for the `--method` option:
- `GET`
- `POST`
- `PUT`
- `PATCH`
- `DELETE`
- `OPTIONS`
- `HEAD`

When a method is specified, the file is named with the method suffix (e.g., `users.post.ts`).

### Dynamic Segments

When using shells or the Nx Generate UI, you can enter dynamic parameters with either syntax:

- **Colon syntax:** `users/:id` (shell-friendly)
- **Bracket syntax:** `users/[id]` (AnalogJS native)

The generator automatically converts colon syntax to AnalogJS bracket notation.

## Init Auth Generator

### Usage

```bash
npx nx generate @analog-tools/generator:init-auth --project=analog-example
```

Or using the Nx Console UI:

```bash
npx nx generate @analog-tools/generator:init-auth
```

### What it does

Initializes authentication in your AnalogJS application using `@analog-tools/auth`. This generator automates the complete setup process by:

1. **Creating `auth.config.ts`** in the application root (`src/`)
   - Configures authentication provider (OAuth/OIDC)
   - Sets up session storage (Redis by default)
   - Defines unprotected routes

2. **Creating server middleware** at `src/server/middleware/auth.ts`
   - Implements authentication middleware using `useAnalogAuth`
   - Handles authentication flow for all API routes

3. **Updating `app.config.ts`**
   - Adds `provideAuthClient()` provider for client-side authentication
   - Adds `authInterceptor` to HTTP client interceptors

4. **Updating `vite.config.ts`**
   - Adds `@analog-tools/auth` to SSR `noExternal` configuration
   - Ensures proper server-side rendering of auth components

### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `project` | `string` | Yes | The name of the AnalogJS application project |

### Example

```bash
# Initialize auth for an application named 'my-app'
npx nx generate @analog-tools/generator:init-auth --project=my-app
```

### Post-Generation Steps

After running the generator, you'll need to:

1. **Configure your authentication provider** in `auth.config.ts`:
   - Set up OAuth/OIDC provider details
   - Configure callback URLs
   - Define scope and audience

2. **Set environment variables**:
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

3. **Install and start Redis** (if not already installed):
   ```bash
   # macOS
   brew install redis
   brew services start redis
   
   # Ubuntu/Debian
   sudo apt-get install redis-server
   sudo systemctl start redis
   
   # Docker
   docker run -d -p 6379:6379 redis:alpine
   ```

### Generated Structure

After running the generator, your project will have:

```
src/
├── auth.config.ts                    # Authentication configuration
├── app/
│   └── app.config.ts                 # Updated with auth providers
└── server/
    └── middleware/
        └── auth.ts                   # Authentication middleware
vite.config.ts                         # Updated with SSR configuration
```

### Dependencies

This generator requires:
- `@analog-tools/auth` - Core authentication library
- `@analog-tools/auth/angular` - Angular integration
- Redis server for session storage

### Notes

- The generator only works with application projects, not libraries
- If `vite.config.ts` is not found, you'll need to manually add `@analog-tools/auth` to `ssr.noExternal`
- The default session storage is Redis; you can modify this in `auth.config.ts`
- All routes are protected by default except those in the `unprotectedRoutes` array

For more details, see the [init-auth generator documentation](src/generators/init-auth/README.md).

## Testing

Run `npx nx test @analog-tools/generator` to execute the Vitest suite and
ensure all generators behave as expected.
# analog

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build analog` to build the library.

## Running unit tests

Run `nx test analog` to execute the unit tests via [Vitest](https://vitest.dev/).
