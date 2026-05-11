import { useAnalogAuth } from '@analog-tools/auth';
import { defineEventHandler, H3Event } from 'h3';
import { authConfig } from '../../auth.config';

/**
 * Authentication middleware for protected API routes
 * To be used with Analog.js middleware structure
 */
export default defineEventHandler(async (event: H3Event) => {
  return useAnalogAuth(authConfig, event);
});
