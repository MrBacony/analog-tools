import { H3Event } from 'h3';
import { AnalogAuthConfig } from '../types/auth.types';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';
import { handleAuthRoute } from './handleAuthRoute';
import { useAnalogAuthMiddleware } from './useAnalogAuthMiddleware';
import { registerService } from '@analog-tools/inject';

/**
 * Configures and initializes the OAuth authentication service
 *
 * @param config The OAuth authentication configuration
 * @param event The H3 event object
 * @throws Error if any mandatory configuration values are missing
 */
export async function useAnalogAuth(config: AnalogAuthConfig, event: H3Event) {
  // Validate mandatory configuration values
  const mandatoryFields: Array<keyof AnalogAuthConfig> = [
    'issuer',
    'clientId',
    'clientSecret',
    'callbackUri',
  ];

  const missingFields = mandatoryFields.filter((field) => !config[field]);

  if (missingFields.length > 0) {
    throw new Error(
      `AnalogAuth initialization failed: Missing mandatory configuration values: ${missingFields.join(
        ', '
      )}`
    );
  }
  // Initialize the authentication service with validated config
  registerService(OAuthAuthenticationService, config);

  await useAnalogAuthMiddleware(event);

  return handleAuthRoute(event);
}
