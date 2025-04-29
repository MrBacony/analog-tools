# AnalogJS Library Structure Explanation - Demo Library

This document explains the file structure of an AnalogJS library with tRPC integration using the `demo` library as an example.

## Overall Structure

The demo library follows a well-organized structure that separates concerns between frontend components, backend API routes, and shared functionality. Here's the complete structure of the demo library:

```
libs/demo/
  ├── eslint.config.cjs           # ESLint configuration for the library
  ├── project.json                # NX project configuration
  ├── README.md                   # Library documentation
  ├── tsconfig.json               # TypeScript configuration
  ├── tsconfig.lib.json           # TypeScript configuration for library compilation
  ├── tsconfig.spec.json          # TypeScript configuration for tests
  ├── vite.config.mts             # Vite configuration
  └── src/                        # Source code directory
      ├── index.ts                # Main entry point and exports
      ├── test-setup.ts           # Test setup configuration
      ├── api/                    # API and backend functionality
      │   ├── routes/             # API routes (following Nitro conventions)
      │   │   └── api/
      │   │       └── demo/       # Demo-specific API endpoints
      │   │           ├── hello.ts            # Simple REST API endpoint
      │   │           └── trpc/
      │   │               └── [trpc].ts       # tRPC API handler
      │   └── trpc/              # tRPC implementation
      │       ├── context.ts     # Request context for tRPC
      │       ├── trpc.ts        # tRPC instance setup
      │       ├── trpc-client.ts # Client for consuming the tRPC API
      │       └── routers/       # tRPC routers (endpoints)
      │           ├── demo.ts    # Demo-specific routes
      │           └── index.ts   # Combined router exports
      ├── lib/                   # Library components and models
      │   └── demo/
      │       ├── demo.component.ts     # Angular component
      │       ├── demo.component.spec.ts # Component tests
      │       └── demo.model.ts         # Data models
      └── pages/                 # AnalogJS file-based routing pages
          └── demo/
              ├── (demo).page.ts # Parenthesized route (grouped route)
              └── demo.page.ts   # Standard page route
```

## Key Components Explained

### 1. Library Entry Point

The `index.ts` file serves as the main entry point for the library. It exports the components, models, and tRPC client so they can be imported by other applications or libraries:

```typescript
// src/index.ts
export * from './lib/demo/demo.component';
export * from './lib/demo/demo.model';
export * from './api/trpc/trpc-client';
```

### 2. API Structure

#### REST API Endpoints

The demo library can provide standard REST API endpoints using the Nitro server that powers AnalogJS:

```
src/api/routes/api/demo/hello.ts
```

This follows the file-based routing convention used by Nitro, where the file path corresponds to the API endpoint path.

#### tRPC Implementation

tRPC is implemented through several key files:

1. **Context** (`src/api/trpc/context.ts`):
   - Creates the request context for tRPC procedures
   - Useful for adding authentication, database connections, etc.

2. **tRPC Setup** (`src/api/trpc/trpc.ts`):
   - Initializes the tRPC instance
   - Defines procedures and middleware

3. **Routers** (`src/api/trpc/routers/`):
   - `demo.ts` - Contains demo-specific API endpoints
   - `index.ts` - Combines and exports all routers

4. **API Handler** (`src/api/routes/api/demo/trpc/[trpc].ts`):
   - Exposes the tRPC router as a Nitro API route
   - Uses the `createTrpcNitroHandler` from `@analogjs/trpc/server`

5. **tRPC Client** (`src/api/trpc/trpc-client.ts`):
   - Creates a typesafe client for consuming the tRPC API
   - Provides injection functions for Angular components

### 3. Frontend Components

The library contains Angular components in the `src/lib/demo/` directory:

1. **Component** (`demo.component.ts`):
   - Angular component with template and logic
   - Can use the tRPC client to make API calls

2. **Model** (`demo.model.ts`):
   - TypeScript interfaces/types used by the component and tRPC
   - Ensures type consistency across frontend and backend

3. **Tests** (`demo.component.spec.ts`):
   - Component unit tests

### 4. Pages

AnalogJS uses file-based routing similar to Next.js. The demo library includes:

1. **Standard Page** (`src/pages/demo/demo.page.ts`):
   - Exposed as `/demo/demo` route when the library is included in an app

2. **Grouped Route** (`src/pages/demo/(demo).page.ts`):
   - Exposed as `/demo` route when the library is included in an app
   - The parentheses indicate a group route in the AnalogJS routing system
   - Useful for layout grouping or route organization

## Integration with Main Application

The demo library is integrated with the main application in several ways:

1. **Path Mapping** (in root `tsconfig.base.json`):
   ```json
   "paths": {
     "@@app/demo": ["libs/demo/src/index.ts"]
   }
   ```

2. **Vite Configuration** (in app's `vite.config.ts`):
   ```typescript
   analog({
     additionalPagesDirs: ['libs/demo/src/pages'],
     additionalAPIDirs: ['libs/demo/src/api'],
     additionalContentDirs: ['libs/demo/src/content'],
     // other config...
   })
   ```

   > **Important**: You must configure the Vite configuration file for each library you want to integrate with your main application. For every library, you need to add its pages, API routes, and content directories to the respective arrays (`additionalPagesDirs`, `additionalAPIDirs`, and `additionalContentDirs`). Without this configuration, the library's pages won't be accessible through the application's routing system, and its API routes won't be served by the application's server.

This integration allows:
- The application to import components and the tRPC client from the library
- The library's pages to be part of the application's routing
- The library's API routes (including tRPC) to be served by the application
- The library's content to be available through the application's content system

## tRPC Workflow

1. **Define Models**: Create TypeScript interfaces in `demo.model.ts`
2. **Create Router**: Define tRPC procedures in `api/trpc/routers/demo.ts`
3. **Export Router**: Include the router in `api/trpc/routers/index.ts`
4. **Create API Handler**: Set up `api/routes/api/demo/trpc/[trpc].ts`
5. **Use in Components**: Inject the tRPC client in components to make API calls

This structure enables end-to-end type safety from the backend to the frontend, with no manual type definitions or code generation needed between the two.

## Development Workflow

When developing features for the demo library:

1. Define models in `lib/demo/demo.model.ts`
2. Create backend functionality using tRPC in `api/trpc/routers/demo.ts`
3. Implement frontend components in `lib/demo/demo.component.ts`
4. Create pages that use these components in `pages/demo/`
5. Export everything needed from `index.ts`

The main application can then import and use these components, and the library's API routes will be available through the application's server.
