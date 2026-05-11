# init-auth Generator

Initializes authentication setup for an AnalogJS application using `@analog-tools/auth`.

## Usage

```bash
npx nx generate @analog-tools/generator:init-auth --project=your-app-name
```

Or using the Nx Console UI:

```bash
npx nx generate @analog-tools/generator:init-auth
```

## What it does

This generator automates the setup of authentication in your AnalogJS application by:

1. **Creating `auth.config.ts`** in the application root (`src/`)
   - Configures authentication provider (OAuth/OIDC)
   - Sets up session storage (filesystem by default)
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

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `project` | `string` | Yes | The name of the AnalogJS application project |

## Example

```bash
# Initialize auth for an application named 'my-app'
npx nx generate @analog-tools/generator:init-auth --project=my-app
```

## After Generation

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
   SESSION_SECRET=your-secure-random-secret
   ```

   `AUTH_ISSUER`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, and `SESSION_SECRET` are required. The generated `auth.config.ts` throws during startup if any of them are missing.

3. **Review filesystem session storage**:
   The generated config uses the unstorage `fs` driver under `./.sessions`. Adjust `driver.options.base` in `src/auth.config.ts` if your deployment needs a different path.

## File Structure

After running the generator, your project will have:

```
src/
├── auth.config.ts                    # Authentication configuration
├── app/
│   └── app.config.ts                 # Updated with auth providers
└── server/
    └── middleware/
        └── auth.ts                   # Authentication middleware
```

## Dependencies

This generator requires:
- `@analog-tools/auth` - Core authentication library
- `@analog-tools/auth/angular` - Angular integration
- `@analog-tools/session` - Session storage integration

## Notes

- The generator only works with application projects, not libraries
- If `vite.config.ts` is not found, you'll need to manually add `@analog-tools/auth` to `ssr.noExternal`
- The default session storage is filesystem-backed; you can modify this in `auth.config.ts`
- All routes are protected by default except those in `unprotectedRoutes` array
