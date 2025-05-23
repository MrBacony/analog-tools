import { H3Event } from 'h3';
import { inject } from '@analog-tools/inject';
import { OAuthAuthenticationService } from '../services/oauth-authentication.service';

export async function checkAuthentication(event: H3Event) {
  const authService = inject(OAuthAuthenticationService);

  await authService.initSession(event);
  // Check authentication with token refresh capability
  return authService.isAuthenticated(event);
}
