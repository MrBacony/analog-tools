# @analog-tools/auth

> **⚠️ IMPORTANT: Early Development Stage** ⚠️  
> This project is in its early development stage. Breaking changes may happen frequently as the APIs evolve. Use with caution in production environments.

A comprehensive authentication and authorization solution for AnalogJS applications, providing OAuth 2.0/OpenID Connect integration with session management.

[![npm version](https://img.shields.io/npm/v/@analog-tools/auth.svg)](https://www.npmjs.com/package/@analog-tools/auth)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔐 **OAuth 2.0/OpenID Connect Support**: Seamless integration with OAuth providers (Auth0, Keycloak, etc.)
- 🚪 **Route Protection**: Easily protect routes requiring authentication
- 🔄 **Token Management**: Automatic token refresh and expiration handling
- 🍪 **Session Management**: Secure session handling with customizable storage options
- 👤 **User Management**: Extensible user data handling and mapping
- 🔒 **Security Best Practices**: CSRF protection, secure cookies, and proper token validation

## Installation

```bash
npm install @analog-tools/auth
```


## Quick Start

Add OAuth authentication to your AnalogJS application in just a few steps:

1. **Configure middleware in your app**:

```typescript
// src/server/middleware/auth.ts
import { defineEventHandler, H3Event } from 'h3';
import { useAnalogAuth, AnalogAuthConfig } from '@analog-tools/auth';

const authConfig: AnalogAuthConfig = {
  issuer: process.env['AUTH_ISSUER'] || '',
  clientId: process.env['AUTH_CLIENT_ID'] || '',
  clientSecret: process.env['AUTH_CLIENT_SECRET'] || '',
  // Optional audience for providers like Auth0
  audience: process.env['AUTH_AUDIENCE'] || '',
  scope: process.env['AUTH_SCOPE'] || 'openid profile email',
  callbackUri: process.env['AUTH_CALLBACK_URL'] || 'http://localhost:3000/api/auth/callback',
  // Routes that don't require authentication
  unprotectedRoutes: ['/imprint', '/help'],
};

export default defineEventHandler(async (event: H3Event) => {
  return useAnalogAuth(authConfig, event);
});
```

## Configuration Options

The `useAnalogAuth` function accepts a configuration object with the following options:

| Option              | Type                 | Description                                                  | Required |
| ------------------- | -------------------- | ------------------------------------------------------------ | -------- |
| `issuer`            | string               | The OAuth issuer URL (your Identity Provider)                | Yes      |
| `clientId`          | string               | Your OAuth client ID                                         | Yes      |
| `clientSecret`      | string               | Your OAuth client secret                                     | Yes      |
| `audience`          | string               | The API audience (needed for certain providers like Auth0)   | No       |
| `scope`             | string               | OAuth scopes to request (defaults to 'openid profile email') | No       |
| `callbackUri`       | string               | The callback URL registered with your OAuth provider         | Yes      |
| `tokenRefreshApiKey`| string               | API key for securing token refresh endpoints                 | No       |
| `unprotectedRoutes` | string[]             | Array of routes that don't require authentication            | No       |
| `logoutUrl`         | string               | URL to redirect to after logout                              | No       |
| `sessionStorage`    | SessionStorageConfig | Session storage configuration (see below)                    | No       |
| `userHandler`       | UserHandler          | Callbacks for user data processing (see below)               | No       |

### Session Storage Options

By default, the auth package uses Redis for session storage. You can configure this with:

```typescript
useAnalogAuth(
  {
    // ...other options
    sessionStorage: {
      type: 'redis',
      config: {
        host: 'localhost',
        port: 6379,
        password: 'your-password',
        db: 0,
        tls: false,
        keyPrefix: 'auth-session:',
        maxAge: 86400, // 24 hours in seconds
        sessionSecret: 'your-session-secret',
      },
    },
  },
  event
);
```

Alternative storage options:

**Memory Storage** (not recommended for production):

```typescript
useAnalogAuth(
  {
    // ...other options
    sessionStorage: {
      type: 'memory',
      config: {
        sessionSecret: 'your-session-secret',
        maxAge: 86400  // 24 hours in seconds
      }
    }
  }, 
  event
);
```

> **⚠️ KNOWN ISSUE**: The Memory storage option is currently broken and not functioning properly. Please use Redis or another storage backend until this issue is resolved.

### User Data Handling

You can customize how user data is stored and retrieved with the `userHandler` option:

```typescript
useAnalogAuth(
  {
    // ...other options
    userHandler: {
      // Called when a user authenticates - store user in your database
      createOrUpdateUser: async (userInfo) => {
        // Example: store or update user in your database
        const user = await db.users.upsert({
          where: { sub: userInfo.sub },
          update: {
            name: userInfo.name,
            email: userInfo.email,
            lastLogin: new Date(),
          },
          create: {
            sub: userInfo.sub,
            name: userInfo.name,
            email: userInfo.email,
          },
        });

        return user; // This becomes the user object in the session
      },

      // Map user data to what your application needs
      mapUserToLocal: (userInfo) => {
        // Return a simplified user object for your application
        return {
          id: userInfo.id,
          name: userInfo.name,
          email: userInfo.email,
          roles: userInfo.roles || [],
          isAdmin: userInfo.roles?.includes('admin') || false,
        };
      },
    },
  },
  event
);
```

## Advanced Usage

### Token Refresh Strategy

The package implements three token refresh strategies:

1. **Lazy Refresh**: Tokens are refreshed only when needed
2. **Proactive Refresh**: Tokens that are close to expiration are refreshed in the background
3. **Scheduled Refresh**: A scheduled task can refresh tokens before they expire

To implement scheduled refresh (recommended for production):

```typescript
// src/server/routes/api/cron/refresh-tokens.ts
import { defineEventHandler } from 'h3';
import { inject } from '@analog-tools/inject';
import { OAuthAuthenticationService } from '@analog-tools/auth';

export default defineEventHandler(async () => {
  const authService = inject(OAuthAuthenticationService);
  const result = await authService.refreshExpiringTokens();

  return {
    message: `Token refresh complete. Refreshed: ${result.refreshed}, Failed: ${result.failed}, Total sessions: ${result.total}`,
  };
});
```

Then configure a CRON job to call this endpoint regularly (every 5 minutes is recommended).

### CSRF Protection

The package includes CSRF protection by using the OAuth state parameter. Always verify this parameter in your callback handler as shown in the examples.

### Securing API Routes

The middleware automatically protects all routes except those specified in `unprotectedRoutes`. For manual authentication checks in your API routes:

```typescript
// src/server/routes/api/protected-data.ts
import { defineEventHandler, createError } from 'h3';
import { checkAuthentication } from '@analog-tools/auth';
import { inject } from '@analog-tools/inject';

export default defineEventHandler(async (event) => {
  // Manually check if user is authenticated
  if (!(await checkAuthentication(event))) {
    throw createError({
      statusCode: 401,
      message: 'Authentication required',
    });
  }
  
  // Access session data from event context
  const { session } = event.context;
  
  return {
    message: 'Protected data',
    user: session.user
  };
});
```

### Client-Side Authentication

The package provides a complete Angular integration through the `@analog-tools/auth/angular` entry point. This integration includes:

- An `AuthService` for managing authentication state
- Route guards for protecting Angular routes
- HTTP interceptors for handling 401 responses and authorization headers

### TRPC Integration

The `@analog-tools/auth/angular` package provides seamless integration with tRPC for Angular applications, handling authentication automatically.

#### 1. TRPC Client Setup

Use the `createTrpcClientWithAuth` function to wrap your TRPC client with authentication support:

```typescript
// src/trpc-client.ts
import { AppRouter } from './server/trpc/routers';
import { createTrpcClient } from '@analogjs/trpc';
import { inject } from '@angular/core';
import { SuperJSON } from 'superjson';
import { createTrpcClientWithAuth } from '@analog-tools/auth-angular';
import { injectRequest } from '@analogjs/router/tokens';

// Create the TRPC client with AnalogJS
export const { provideTrpcClient, TrpcClient, TrpcHeaders } =
  createTrpcClient<AppRouter>({
    url: '/api/trpc',
    options: {
      transformer: SuperJSON,
    },
  });

// Create a function to inject the authenticated TRPC client
export function injectTrpcClient() {
  return createTrpcClientWithAuth(inject(TrpcClient), injectRequest(), TrpcHeaders);
}
```

#### 2. TRPC Context Configuration

Set up your TRPC context to pass the H3 event:

```typescript
// src/server/trpc/context.ts
import { inferAsyncReturnType } from '@trpc/server';
import type { H3Event } from 'h3';

export const createContext = (event: H3Event) => {
  // Pass the H3 event to tRPC context so we can access session data
  return { event };
};

export type Context = inferAsyncReturnType<typeof createContext>;
```

#### 3. Authentication Middleware

Create an authentication middleware for protected routes:

```typescript
// src/server/trpc/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from './context';
import { SuperJSON } from 'superjson';
import { checkAuthentication } from '@analog-tools/auth';

const t = initTRPC.context<Context>().create({
  transformer: SuperJSON,
});

// Middleware to check if user is authenticated
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!(await checkAuthentication(ctx.event))) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User is not authenticated',
    });
  }

  return next({
    ctx: {
      ...ctx,
      // You could add user info here if needed
    },
  });
});

// Unprotected procedure - can be accessed without authentication
export const publicProcedure = t.procedure;

// Protected procedure - requires authentication
export const protectedProcedure = t.procedure.use(isAuthenticated);

export const router = t.router;
export const middleware = t.middleware;
```

#### Using Protected TRPC Routes

Define your TRPC router with protected routes:

```typescript
// src/server/trpc/routers/my-router.ts
import { protectedProcedure, publicProcedure, router } from '../trpc';

export const myRouter = router({
  // Public route - no authentication required
  public: publicProcedure.query(() => {
    return { message: 'This is public data' };
  }),
  
  // Protected route - requires authentication
  protected: protectedProcedure.query(() => {
    return { message: 'This is protected data' };
  }),
});
```

#### Error Handling

The auth-angular package automatically handles authentication errors from TRPC calls. The `wrapTrpcClientWithErrorHandling` function adds error handling for auth-related errors:

```typescript
// In your component
import { Component } from '@angular/core';
import { injectTrpcClient } from '../trpc-client';

@Component({
  selector: 'app-my-component',
  template: `
    <button (click)="fetchProtectedData()">Fetch Protected Data</button>
    <div *ngIf="data">{{ data | json }}</div>
  `,
})
export class MyComponent {
  private trpc = injectTrpcClient();
  data: any;

  fetchProtectedData() {
    // Will automatically handle auth errors
    this.trpc.my.protected.query().subscribe({
      next: (result) => {
        this.data = result;
      },
      error: (err) => {
        console.error('Error fetching data:', err);
      },
    });
  }
}
```

#### Setup Angular Integration

First, add the auth providers to your `app.config.ts`:

```typescript
// src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideFileRouter } from '@analogjs/router';
import { provideAuthClient, authInterceptor } from '@analog-tools/auth/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    // AnalogJS providers
    provideFileRouter(),
    
    // HTTP client with auth interceptor
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    
    // Auth client provider
    provideAuthClient(),
  ],
};
```

#### Using the Auth Service

Inject the provided `AuthService` in your components:

```typescript
// src/app/pages/profile.page.ts
import { Component, inject, effect } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@analog-tools/auth/angular';

@Component({
  standalone: true,
  template: `
    @if (auth.isLoading()) {
      <div>Loading...</div>
    } @else if (auth.user(); as user) {
      <div class="profile">
        <h1>Welcome, {{ user.name }}</h1>
        <p>Email: {{ user.email }}</p>
        <button (click)="auth.logout()">Logout</button>
      </div>
    } @else {
      <div>
        <h1>Please log in</h1>
        <button (click)="auth.login()">Login</button>
      </div>
    }
  `,
})
export default class ProfilePage {
  auth = inject(AuthService);
}
```

#### Using Route Guards

Protect your routes with the built-in auth guards:

```typescript
// src/app/pages/admin.page.ts
import { Component } from '@angular/core';
import { authGuard, roleGuard } from '@analog-tools/auth/angular';

export const routeMeta = {
  title: 'Admin Page',
  canActivate: [authGuard], // Requires authentication
};

@Component({
  template: `<h1>Admin Page</h1>`,
})
export default class AdminPage {}
```

For role-based access control, use the `roleGuard` with route data:

```typescript
// src/app/pages/super-admin.page.ts
import { Component } from '@angular/core';
import { roleGuard } from '@analog-tools/auth/angular';

export const routeMeta = {
  title: 'Super Admin Page',
  canActivate: [roleGuard],
  data: {
    roles: ['admin', 'super-admin'], // Requires any of these roles
  },
};

@Component({
  template: `<h1>Super Admin Panel</h1>`,
})
export default class SuperAdminPage {}
```

#### User Authentication Management

The package automatically handles user data transformation from various OAuth providers into a standardized format through the `AuthService`:

```typescript
// src/app/services/user.service.ts
import { Injectable, inject } from '@angular/core';
import { AuthService, AuthUser } from '@analog-tools/auth/angular';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private authService = inject(AuthService);
  
  // The AuthService automatically handles user data transformation
  getCurrentUser(): AuthUser | null {
    return this.authService.user();
  }
  
  hasAdminAccess(): boolean {
    return this.authService.hasRoles(['admin']);
  }
}
```

##### Supported Identity Providers

The package automatically handles user data from various OAuth providers:

- **Auth0**: Properly handles Auth0 user profile data and roles
- **Keycloak**: Correctly maps realm and client roles
- **Generic OIDC**: Supports standard OpenID Connect claims

The `AuthService` internally handles all the transformation logic, so you don't need to worry about the specifics of each provider.
```

#### Auth Service API

The `AuthService` provides several key methods and properties:

```typescript
// Core user state
user: Signal<AuthUser | null>;       // User data
isAuthenticated: Signal<boolean>;    // Is user authenticated
isLoading: Signal<boolean>;          // Auth state loading indicator

// Methods
login(targetUrl?: string): void;     // Redirect to login, with optional return URL
logout(): void;                      // Logout and redirect
checkAuthentication(): Promise<boolean>; // Force auth status check
hasRoles(roles: string[]): boolean;  // Check if user has specified roles
```

## Security Considerations

### Authentication Best Practices

1. **Environment Variables**: Store sensitive values like `clientSecret` in environment variables
2. **HTTPS Required**: Always use HTTPS in production environments
3. **Secure Cookies**: The package configures secure cookies in production automatically
4. **Token Storage**: Tokens are only stored server-side, never exposed to the client
5. **Token Validation**: All tokens are properly validated before use
6. **CSRF Protection**: State parameter validation prevents cross-site request forgery

### Production Setup Checklist

1. Set `NODE_ENV=production` to enable secure defaults
2. Configure a strong random `SESSION_SECRET` for cookie signing
3. Use Redis or another persistent store for sessions (in-memory is not suitable for production)
4. Set up token refresh mechanism (preferably scheduled refresh)
5. Configure proper CORS settings if your API is on a different domain
6. Implement rate limiting for auth endpoints to prevent brute force attacks

## Vite Configuration

When using `@analog-tools/auth` with AnalogJS, you need to configure Vite to properly handle the package during server-side rendering. Add the package to the `noExternal` array in your `vite.config.ts`:

```typescript
// vite.config.ts
import analog from '@analogjs/platform';
import { defineConfig } from 'vite';

export default defineConfig({
  // ...other config
  ssr: {
    noExternal: ['@analogjs/trpc', '@trpc/server', '@analog-tools/auth'],
  },
  // ...other config
});
```

## Troubleshooting

### Common Issues

**Error: Failed to fetch OpenID configuration**

- Check your internet connection
- Verify the issuer URL is correct
- Ensure the OAuth provider is online

**Error: Failed to exchange authorization code**

- Check that `clientId` and `clientSecret` are correct
- Verify that `callbackUri` matches what's registered with your provider

**Error: Failed to refresh token**

- Token might be expired or revoked
- Verify that the refresh token is valid
- Check if your OAuth provider limits refresh token use

### Debugging

Enable detailed logging by setting the environment variable:

```
DEBUG=analog-auth:*
```

## Environment Setup

For local development, create a `.env` file with the following variables:

```
AUTH_ISSUER=https://your-issuer.com
AUTH_CLIENT_ID=your-client-id
AUTH_CLIENT_SECRET=your-client-secret
AUTH_AUDIENCE=your-audience
AUTH_SCOPE=openid profile email
AUTH_CALLBACK_URL=http://localhost:3000/api/auth/callback
SESSION_SECRET=your-session-secret
REDIS_URL=redis://localhost:6379
AUTH_LOGOUT_URL=http://localhost:3000
```

## Examples

### Complete Integration Example

This example shows how to set up a comprehensive authentication solution with the merged package:

#### Server-side Setup

```typescript
// src/server/middleware/auth.ts
import { defineEventHandler, H3Event } from 'h3';
import { useAnalogAuth, AnalogAuthConfig } from '@analog-tools/auth';

// Define auth configuration
const authConfig: AnalogAuthConfig = {
  issuer: 'https://keycloak.your-domain.com/realms/your-realm',
  clientId: process.env['AUTH_CLIENT_ID'] || '',
  clientSecret: process.env['AUTH_CLIENT_SECRET'] || '',
  scope: 'openid profile email',
  callbackUri: 'http://localhost:3000/api/auth/callback',
  unprotectedRoutes: ['/api/public', '/api/auth/login', '/api/auth/callback'],
  // Configure Redis session storage for production
  sessionStorage: {
    type: 'redis',
    config: {
      url: process.env['REDIS_URL'] || 'redis://localhost:6379',
      ttl: 86400, // 24 hours
      sessionSecret: process.env['SESSION_SECRET'] || 'your-session-secret',
    },
  },
  // Custom user data handling
  userHandler: {
    mapUserToLocal: (userInfo) => ({
      id: userInfo.sub,
      name: userInfo.name,
      email: userInfo.email,
      roles: userInfo.realm_access?.roles || [],
    }),
    createOrUpdateUser: async (user) => {
      // Store or update user in your database
      console.log('User authenticated:', user);
      return user;
    },
  },
};

export default defineEventHandler(async (event: H3Event) => {
  return useAnalogAuth(authConfig, event);
});
```

#### Angular Client Setup

```typescript
// src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideFileRouter, requestContextInterceptor } from '@analogjs/router';
import { provideClientHydration } from '@angular/platform-browser';
import { 
  provideAuthClient, 
  authInterceptor 
} from '@analog-tools/auth/angular';
import { provideTrpcClient } from '../trpc-client';

export const appConfig: ApplicationConfig = {
  providers: [
    provideFileRouter(),
    provideClientHydration(),
    
    // Auth configuration
    provideAuthClient(),
    
    // HTTP configuration with auth interceptor
    provideHttpClient(
      withInterceptors([
        requestContextInterceptor, 
        authInterceptor
      ])
    ),
    
    // TRPC client with auth integration
    provideTrpcClient(),
  ],
};
```

#### Protected Route Example

```typescript
// src/app/pages/protected.page.ts
import { Component } from '@angular/core';
import { authGuard } from '@analog-tools/auth/angular';

export const routeMeta = {
  title: 'Protected Page',
  canActivate: [authGuard],
};

@Component({
  template: `
    <div class="p-4">
      <h1 class="text-2xl font-bold mb-4">Protected Content</h1>
      <p>This page is only visible to authenticated users.</p>
    </div>
  `,
})
export default class ProtectedPage {}
```

## Package Architecture

The `@analog-tools/auth` package is structured as a multi-entry point package that provides a comprehensive authentication solution:

- **Main Entry Point**: `@analog-tools/auth` 
  - Server-side OAuth implementation with H3 middleware
  - Session management integration
  - API route handlers

- **Angular Entry Point**: `@analog-tools/auth/angular`
  - Angular-specific authentication services
  - Route guards and HTTP interceptors
  - Reactive state management with Angular signals
  - User transformation utilities for different providers (Auth0, Keycloak, etc.)
  - tRPC middleware for protected procedures
  - Authentication utilities for tRPC routes
  - Error handling for authentication failures

### Relationship with Other Packages

This package relies on other `@analog-tools` packages:

- `@analog-tools/session`: For secure session management
- `@analog-tools/inject`: For dependency injection
- `@analog-tools/logger`: For structured logging

## Contributing

Contributions are welcome! Please check out our [contribution guidelines](../CONTRIBUTING.md).

## License

MIT
