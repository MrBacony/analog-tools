# @analog-tools/auth

A comprehensive authentication and authorization solution for AnalogJS applications, providing OAuth 2.0/OpenID Connect integration with session management.

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
import { defineEventHandler } from 'h3';
import { useAnalogAuth } from '@analog-tools/auth';

export default defineEventHandler(async (event) => {
  // Configure auth with your OAuth provider details
  await useAnalogAuth(
    {
      issuer: 'https://your-issuer.com',
      clientId: process.env.AUTH_CLIENT_ID || '',
      clientSecret: process.env.AUTH_CLIENT_SECRET || '',
      audience: process.env.AUTH_AUDIENCE || '',
      scope: 'openid profile email',
      callbackUri: 'http://localhost:3000/api/auth/callback',
      // Routes that don't require authentication
      unprotectedRoutes: ['/api/auth/login', '/api/auth/callback', '/api/public'],
    },
    event
  );
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
| `unprotectedRoutes` | string[]             | Array of routes that don't require authentication            | No       |
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
      },
    },
  },
  event
);
```

Alternative storage options:

**Memory Storage** (not recommended for production):

```typescript
sessionStorage: {
  type: 'memory',
  config: {
    maxAge: 86400  // 24 hours in seconds
  }
}
```

**Cookie Storage** (for simple use cases):

```typescript
sessionStorage: {
  type: 'cookie',
  config: {
    maxAge: 86400,  // 24 hours in seconds
    secure: true,   // Require HTTPS
    sameSite: 'lax',
    domain: 'your-domain.com',
    path: '/'
  }
}
```

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

### Custom Environment Variables

You can customize the package behavior with these environment variables:

- `SESSION_SECRET`: Secret used for signing session cookies (required in production)
- `REDIS_URL`: Redis connection URL for session storage
- `AUTH_LOGOUT_URL`: URL to redirect to after logout
- `NODE_ENV`: Set to 'production' for secure cookie settings

### Token Refresh Strategy

The package implements three token refresh strategies:

1. **Lazy Refresh**: Tokens are refreshed only when needed
2. **Proactive Refresh**: Tokens that are close to expiration are refreshed in the background
3. **Scheduled Refresh**: A scheduled task can refresh tokens before they expire

To implement scheduled refresh (recommended for production):

```typescript
// src/server/routes/api/cron/refresh-tokens.ts
import { defineEventHandler } from 'h3';
import { OAuthAuthenticationService } from '@analog-tools/auth';

export default defineEventHandler(async () => {
  const authService = OAuthAuthenticationService.getInstance();
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

The middleware automatically protects all routes except those specified in `unprotectedRoutes`. For manual checks:

### Client-Side Authentication

To use authentication in your Angular components:

```typescript
// src/app/services/auth.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, map, of, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private userSubject = new BehaviorSubject<any>(null);
  user$ = this.userSubject.asObservable();

  isAuthenticated$ = this.user$.pipe(map((user) => !!user));

  // Get current user from API
  fetchUser() {
    return this.http.get<any>('/api/auth/user').pipe(
      tap((response) => this.userSubject.next(response.user)),
      catchError(() => {
        this.userSubject.next(null);
        return of({ user: null });
      })
    );
  }

  // Redirect to login
  login() {
    this.http.get<any>('/api/auth/login').subscribe((response) => {
      window.location.href = response.url;
    });
  }

  // Handle logout
  logout() {
    this.http.get<any>('/api/auth/logout').subscribe((response) => {
      this.userSubject.next(null);
      window.location.href = response.url;
    });
  }
}
```

Then use in your components:

```typescript
// src/app/pages/profile.page.ts
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  standalone: true,
  template: `
    @if (auth.user$ | async; as user) {
    <div class="profile">
      <h1>Welcome, {{ user.name }}</h1>
      <p>Email: {{ user.email }}</p>
      <button (click)="auth.logout()">Logout</button>
    </div>
    } @else {
    <div>Loading...</div>
    }
  `,
})
export default class ProfilePage {
  auth = inject(AuthService);
  router = inject(Router);

  constructor() {
    this.auth.isAuthenticated$.subscribe((isAuthenticated) => {
      if (!isAuthenticated) {
        this.router.navigate(['/login']);
      }
    });
  }
}
```

## Security Considerations

1. **Environment Variables**: Store sensitive values like `clientSecret` in environment variables
2. **HTTPS**: Always use HTTPS in production
3. **Production Setup**:
   - Set `NODE_ENV=production`
   - Set a strong `SESSION_SECRET`
   - Use Redis or another persistent store for sessions
   - Configure secure cookies

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
AUTH_CLIENT_ID=your-client-id
AUTH_CLIENT_SECRET=your-client-secret
AUTH_AUDIENCE=your-audience
SESSION_SECRET=your-session-secret
REDIS_URL=redis://localhost:6379
AUTH_LOGOUT_URL=http://localhost:3000
```

## Examples

### Integration with Keycloak

```typescript
// src/server/middleware/auth.ts
import { defineEventHandler } from 'h3';
import { useAnalogAuth } from '@analog-tools/auth';

export default defineEventHandler(async (event) => {
  await useAnalogAuth(
    {
      issuer: 'https://keycloak.your-domain.com/realms/your-realm',
      clientId: process.env.AUTH_CLIENT_ID || '',
      clientSecret: process.env.AUTH_CLIENT_SECRET || '',
      scope: 'openid profile email',
      callbackUri: 'http://localhost:3000/api/auth/callback',
      unprotectedRoutes: ['/your-unprotected-endpoint'],
      userHandler: {
        mapUserToLocal: (userInfo) => ({
          id: userInfo.sub,
          name: userInfo.name,
          email: userInfo.email,
          roles: userInfo.realm_access?.roles || [],
        }),
      },
    },
    event
  );
});
```

## Contributing

Contributions are welcome! Please check out our [contribution guidelines](../CONTRIBUTING.md).

## License

MIT
