import { AnalogAuthConfig } from '@analog-tools/auth';

export const authConfig: AnalogAuthConfig = {
  issuer: process.env['AUTH_ISSUER'] || '',
  clientId: process.env['AUTH_CLIENT_ID'] || '',
  clientSecret: process.env['AUTH_CLIENT_SECRET'] || '',
  audience: process.env['AUTH_AUDIENCE'] || '',
  scope: process.env['AUTH_SCOPE'] || '',
  callbackUri: process.env['AUTH_CALLBACK_URL'] || '',
  /*
  sessionStorage: {
    type: 'memory', // Use 'redis' for Redis-backed sessions
    config: {
      prefix: 'sess', // Session key prefix
      ttl: 60 * 60, // Session TTL in seconds (default: 1 hour)
      sessionSecret: process.env['SESSION_SECRET'] || 'dev-secret-change-me-in-production'
    },
  },*/
  sessionStorage: {
    type: 'redis',
    config: {
      url: process.env['REDIS_HOST'] || 'localhost',
      port: process.env['REDIS_PORT'] || 6379,
    },
  },
};
