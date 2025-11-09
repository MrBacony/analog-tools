# Analog Tools Generators

Custom Nx generators that scaffold AnalogJS projects with consistent
file-based routing, API handlers, and supporting configuration.

## Available Generators

- `@analog-tools/generator:library` – creates a feature-complete AnalogJS
	library with optional pages, content routes, REST endpoints, and tRPC support.
- `@analog-tools/generator:api-route` – adds a new API handler to an
	application or library following AnalogJS routing conventions.

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

## Testing

Run `npx nx test @analog-tools/generator` to execute the Vitest suite and
ensure all generators behave as expected.
# analog

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build analog` to build the library.

## Running unit tests

Run `nx test analog` to execute the unit tests via [Vitest](https://vitest.dev/).
