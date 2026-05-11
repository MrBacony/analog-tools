import { AnalogAuthConfig } from '@analog-tools/auth';

const sessionSecret = process.env['SESSION_SECRET'];

if (!sessionSecret) {
  throw new Error(
    'SESSION_SECRET environment variable is required for Analog auth session storage.',
  );
}

export const authConfig: AnalogAuthConfig = {
  issuer: process.env['AUTH_ISSUER'] || '',
  clientId: process.env['AUTH_CLIENT_ID'] || '',
  clientSecret: process.env['AUTH_CLIENT_SECRET'] || '',
  audience: process.env['AUTH_AUDIENCE'] || '',
  scope: process.env['AUTH_SCOPE'] || 'openid profile email',
  callbackUri:
    process.env['AUTH_CALLBACK_URL'] ||
    'http://localhost:4201/api/auth/callback',
  unprotectedRoutes: ['/', '/info', '/api/v1/health'],
  whitelistFileTypes: ['.css', '.js', '.png', '.svg', '.ico', '.woff2'],

  sessionStorage: {
    sessionSecret,
    ttl: 86400, // 24 hours
    driver: {
      type: 'fs',
      options: {
        base: './.sessions',
      },
    },
  },
};
