import { useAnalogAuth, AnalogAuthConfig } from '@analog-tools/auth';
import { defineEventHandler, H3Event } from 'h3';
import { ServiceRegistry } from '@analog-tools/inject';

const authConfig: AnalogAuthConfig = {
  issuer: process.env['AUTH_ISSUER'] || '',
  clientId: process.env['AUTH_CLIENT_ID'] || '',
  clientSecret: process.env['AUTH_CLIENT_SECRET'] || '',
  audience: process.env['AUTH_AUDIENCE'] || '',
  scope: process.env['AUTH_SCOPE'] || '',
  callbackUri: process.env['AUTH_CALLBACK_URL'] || '',
};

/**
 * Authentication middleware for protected API routes
 * To be used with Analog.js middleware structure
 */
export default defineEventHandler(async (event: H3Event) => {
  ServiceRegistry.initialize();
  return useAnalogAuth(authConfig, event);
});
