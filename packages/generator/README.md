# Analog Tools Generators

Custom Nx generators that scaffold AnalogJS projects with consistent
file-based routing, API handlers, and supporting configuration.

## Available Generators

- `@analog-tools/generator:library` – creates a feature-complete AnalogJS
	library with optional pages, content routes, REST endpoints, and tRPC support.
- `@analog-tools/generator:api-route` – adds a new API handler to an
	application or library following AnalogJS routing conventions.
- `@analog-tools/generator:init-auth` – initializes authentication setup for an
	AnalogJS application using `@analog-tools/auth`.

## API Route Generator

```
npx nx generate @analog-tools/generator:api-route --project=analog-example --route=v1/hello
```

This command creates `apps/analog-example/src/server/routes/api/v1/hello.ts`
with a ready-to-use `defineEventHandler` stub. When targeting a library,
routes are generated under `libs/<name>/src/api/routes/api`.

### Method-specific Handlers

Provide the optional `--method` flag to create method-specific files such as
`hello.post.ts`.

```
npx nx g @analog-tools/generator:api-route --project=analog-example --route=v1/users --method=POST
```

Supported methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD`.
Omit the flag to generate a generic handler (`hello.ts`).

### Dynamic Segments

When using shells or the Nx Generate UI, enter dynamic parameters with a colon
syntax (`users/:id`). The generator converts them to AnalogJS bracket routes
(`users/[id]`) automatically, avoiding the need for shell escaping.

## Init Auth Generator

```
npx nx generate @analog-tools/generator:init-auth --project=analog-example
```

This command initializes authentication in your AnalogJS application by:

1. Creating `src/auth.config.ts` with OAuth/OIDC configuration
2. Creating `src/server/middleware/auth.ts` for API route protection
3. Updating `src/app/app.config.ts` with auth providers and interceptors
4. Updating `vite.config.ts` to include `@analog-tools/auth` in SSR configuration

### Post-Generation Steps

After running the generator, you need to:

1. Configure your OAuth/OIDC provider in `auth.config.ts`
2. Set up environment variables:
   ```env
   AUTH_ISSUER=https://your-auth-provider.com
   AUTH_CLIENT_ID=your-client-id
   AUTH_CLIENT_SECRET=your-client-secret
   AUTH_AUDIENCE=your-api-audience
   AUTH_CALLBACK_URL=http://localhost:4200/api/auth/callback
   REDIS_URL=redis://localhost:6379
   SESSION_SECRET=your-secure-random-secret
   ```
3. Install and start Redis for session storage

See the [init-auth generator documentation](src/generators/init-auth/README.md) for more details.

## Testing

Run `npx nx test @analog-tools/generator` to execute the Vitest suite and
ensure all generators behave as expected.
# analog

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build analog` to build the library.

## Running unit tests

Run `nx test analog` to execute the unit tests via [Vitest](https://vitest.dev/).
