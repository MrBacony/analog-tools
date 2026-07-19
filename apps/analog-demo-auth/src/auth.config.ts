import { AnalogAuthConfig } from '@analog-tools/auth';

function readRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
}

const issuer = readRequiredEnv('AUTH_ISSUER');
const clientId = readRequiredEnv('AUTH_CLIENT_ID');
const clientSecret = readRequiredEnv('AUTH_CLIENT_SECRET');
const sessionSecret = readRequiredEnv('SESSION_SECRET');

export const authConfig: AnalogAuthConfig = {
  issuer,
  clientId,
  clientSecret,
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
    cookieName: process.env['SESSION_COOKIE_NAME'] || 'auth.session.demo-auth',
    driver: {
      type: 'fs',
      options: {
        base: './.sessions',
      },
    },
  },
};
