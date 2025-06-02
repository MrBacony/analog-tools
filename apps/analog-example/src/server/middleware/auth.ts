import { AnalogAuthConfig, useAnalogAuth } from '@analog-tools/auth';
import { defineEventHandler, H3Event } from 'h3';

const authConfig: AnalogAuthConfig = {
  issuer: process.env['AUTH_ISSUER'] || '',
  clientId: process.env['AUTH_CLIENT_ID'] || '',
  clientSecret: process.env['AUTH_CLIENT_SECRET'] || '',
  audience: process.env['AUTH_AUDIENCE'] || '',
  scope: process.env['AUTH_SCOPE'] || '',
  callbackUri: process.env['AUTH_CALLBACK_URL'] || '',
  sessionStorage: {
    type: 'redis',
    config: {
      url: process.env['REDIS_HOST'] || 'localhost',
      port: process.env['REDIS_PORT'] || 6379,
    },
  },
};

/**
 * Authentication middleware for protected API routes
 * To be used with Analog.js middleware structure
 */
export default defineEventHandler(async (event: H3Event) => {
  return useAnalogAuth(authConfig, event);
});
