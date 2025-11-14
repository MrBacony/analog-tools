import { AnalogAuthConfig } from '@analog-tools/auth';

export const authConfig: AnalogAuthConfig = {
  issuer: process.env['AUTH_ISSUER'] || '',
  clientId: process.env['AUTH_CLIENT_ID'] || '',
  clientSecret: process.env['AUTH_CLIENT_SECRET'] || '',
  audience: process.env['AUTH_AUDIENCE'] || '',
  scope: process.env['AUTH_SCOPE'] || 'openid profile email',
  callbackUri: process.env['AUTH_CALLBACK_URL'] || '',
  unprotectedRoutes: [],

  sessionStorage: {
    sessionSecret: process.env['SESSION_SECRET'] || 'default-dev-secret',

    driver: {
      type: 'redis',
      options: {
        url: process.env['REDIS_URL'] || 'redis://localhost:6379',
        ttl: 86400, // 24 hours
      },
    },
  },
};
