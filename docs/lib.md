# Using tRPC in AnalogJS Libraries

This guide explains how to implement and use tRPC within libraries in an AnalogJS monorepo.

## Table of Contents
- [Introduction](#introduction)
- [Setup](#setup)
  - [Directory Structure](#directory-structure)
  - [Required Dependencies](#required-dependencies)
- [Implementation Steps](#implementation-steps)
  - [1. Create the Context](#1-create-the-context)
  - [2. Set Up the tRPC Instance](#2-set-up-the-trpc-instance)
  - [3. Create Routers](#3-create-routers)
  - [4. Configure the API Route](#4-configure-the-api-route)
  - [5. Create a tRPC Client](#5-create-a-trpc-client)
  - [6. Export from Library](#6-export-from-library)
- [Using the tRPC Client](#using-the-trpc-client)
- [Integration with AnalogJS App](#integration-with-analogjs-app)
- [Examples](#examples)

## Introduction

tRPC allows you to build fully type-safe APIs without schema validation or code generation. When combined with AnalogJS libraries in a monorepo, it enables seamless communication between your Angular components and the backend, with complete type safety across the entire stack.

## Setup

### Directory Structure

For a typical AnalogJS library using tRPC, structure your files as follows:

```
libs/your-lib/
  ├── src/
  │   ├── index.ts                     # Exports library components and tRPC client
  │   ├── lib/                         # Library components and models
  │   │   └── your-lib/
  │   │       ├── component.ts
  │   │       └── model.ts
  │   ├── pages/                       # Library pages
  │   │   └── your-lib/
  │   │       └── page.ts
  │   └── api/
  │       ├── routes/                  # API routes
  │       │   └── api/
  │       │       └── your-lib/
  │       │           └── trpc/
  │       │               └── [trpc].ts  # tRPC API handler
  │       └── trpc/                    # tRPC implementation
  │           ├── context.ts           # Request context
  │           ├── trpc.ts              # tRPC instance setup
  │           ├── trpc-client.ts       # Client for consuming tRPC API
  │           └── routers/
  │               ├── index.ts         # Main router export
  │               └── feature.ts       # Feature-specific router
```

### Required Dependencies

Ensure you have the following dependencies installed:

- `@analogjs/trpc` - AnalogJS integration for tRPC
- `@trpc/server` - tRPC server implementation
- `@trpc/client` - tRPC client implementation
- `superjson` - For handling complex data types (dates, etc.)
- `zod` - For input validation (optional but recommended)

## Implementation Steps

### 1. Create the Context

Create a context file (`src/api/trpc/context.ts`) to define request context:

```typescript
import { inferAsyncReturnType } from '@trpc/server';

/**
 * Creates context for an incoming request
 * @link https://trpc.io/docs/context
 */
export const createContext = () => ({});
export type Context = inferAsyncReturnType<typeof createContext>;
```

You can extend this context with user authentication, database connections, etc.

### 2. Set Up the tRPC Instance

Create the tRPC instance (`src/api/trpc/trpc.ts`):

```typescript
import { initTRPC } from '@trpc/server';
import { Context } from './context';
import { SuperJSON } from 'superjson';

const t = initTRPC.context<Context>().create({
  transformer: SuperJSON,
});

/**
 * Unprotected procedure
 **/
export const publicProcedure = t.procedure;
export const router = t.router;
export const middleware = t.middleware;
```

### 3. Create Routers

Create feature routers in `src/api/trpc/routers/`:

1. First, create a specific feature router (`src/api/trpc/routers/feature.ts`):

```typescript
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

export const featureRouter = router({
  list: publicProcedure.query(() => {
    // Return data
    return [{ id: 1, name: 'Item 1' }];
  }),
  
  create: publicProcedure
    .input(
      z.object({
        name: z.string(),
      })
    )
    .mutation(({ input }) => {
      // Create new item
      return { id: 2, name: input.name };
    }),
});
```

2. Then create an index router (`src/api/trpc/routers/index.ts`) that combines all feature routers:

```typescript
import { router } from '../trpc';
import { featureRouter } from './feature';

export const libRouter = router({
  feature: featureRouter,
});

// Export type definition of API
export type LibRouter = typeof libRouter;
```

### 4. Configure the API Route

Create an API route handler for tRPC (`src/api/routes/api/your-lib/trpc/[trpc].ts`):

```typescript
import { createTrpcNitroHandler } from '@analogjs/trpc/server';

import { createContext } from '../../../../trpc/context';
import { libRouter } from '../../../../trpc/routers';

// export API handler
export default createTrpcNitroHandler({
  router: libRouter,
  createContext,
});
```

### 5. Create a tRPC Client

Create a client to consume the tRPC API (`src/api/trpc/trpc-client.ts`):

```typescript
import { LibRouter } from './routers';
import { createTrpcClient } from '@analogjs/trpc';
import { inject } from '@angular/core';
import { SuperJSON } from 'superjson';

export const { provideTrpcClient, TrpcClient: TrpcLibClient } = createTrpcClient<LibRouter>({
  url: '/api/your-lib/trpc',
  options: {
    transformer: SuperJSON,
  },
});

export function provideTrpcLibClient() {
  return provideTrpcClient();
}

export function injectTrpcLibClient() {
  return inject(TrpcLibClient);
}
```

### 6. Export from Library

Export the tRPC client in your library's main index file (`src/index.ts`):

```typescript
export * from './lib/your-lib/component';
export * from './api/trpc/trpc-client';
```

## Using the tRPC Client

In your library components or pages, use the tRPC client as follows:

```typescript
import { Component, resource } from '@angular/core';
import { injectTrpcLibClient } from '@your-lib';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'lib-feature-page',
  template: `
    <div>
      <h1>Feature</h1>
      @for (item of items.value(); track item.id) {
        <div>{{ item.name }}</div>
      }
    </div>
  `,
})
export default class FeaturePageComponent {
  private trpc = injectTrpcLibClient();

  public items = resource({
    loader: () => lastValueFrom(this.trpc.feature.list.query()),
  });
}
```

## Integration with AnalogJS App

To use your library's tRPC API in an AnalogJS app:

1. Update your app's `vite.config.ts` to include your library's API and pages:

```typescript
analog({
  additionalPagesDirs: ['libs/your-lib/src/pages'],
  additionalAPIDirs: ['libs/your-lib/src/api'],
  nitro: {
    // ...nitro config
  },
})
```

2. Add your library's tRPC client provider to your app's providers:

```typescript
// In app.config.ts
import { provideTrpcLibClient } from '@your-lib';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...other providers
    provideTrpcLibClient(),
  ],
};
```

## Examples

Here's a complete example of a tRPC router for a notes feature:

```typescript
// In libs/notes/src/api/trpc/routers/notes.ts
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { Note } from '../../../lib/notes/note.model';

let noteId = 0;
const notes: Note[] = [{ id: noteId++, note: 'Hello world', createdAt: new Date().toISOString() }];

export const noteRouter = router({
  create: publicProcedure
    .input(
      z.object({
        note: z.string(),
      })
    )
    .mutation(({ input }) =>
      notes.push({
        id: noteId++,
        note: input.note,
        createdAt: new Date().toISOString(),
      })
    ),
  list: publicProcedure.query(() => notes),
  remove: publicProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(({ input }) => {
      const index = notes.findIndex((note) => input.id === note.id);
      notes.splice(index, 1);
    }),
});
```

And using this router in a component:

```typescript
// In libs/notes/src/pages/notes/notes.page.ts
import { Component, resource } from '@angular/core';
import { injectTrpcLibClient } from '@app/notes';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'lib-notes-page',
  template: `
    <div>
      <h1>Notes</h1>
      @for (note of notes.value(); track note.id) {
        <div>{{ note.note }}</div>
      }
    </div>
  `,
})
export default class NotesPageComponent {
  private trpc = injectTrpcLibClient();

  public notes = resource({
    loader: () => lastValueFrom(this.trpc.note.list.query()),
  });
}
```
