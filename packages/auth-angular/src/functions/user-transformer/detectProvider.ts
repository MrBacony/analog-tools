import { AuthUser } from '../../auth.service';
import { Auth0UserInfo, fromAuth0 } from './fromAuth0';
import { fromKeycloak, KeycloakUserInfo } from './fromKeycloak';

/**
 * Provider type for identity providers
 */
export type IdentityProvider = 'keycloak' | 'auth0' | 'unknown';

/**
 * Generic user info type that can represent data from any provider
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GenericUserInfo = Record<string, any>;

/**
 * Detects the identity provider based on user data structure
 * @param userInfo - User information object from the provider
 * @returns The detected identity provider type
 */
export function detectProvider(userInfo: GenericUserInfo): IdentityProvider {
  if (!userInfo) {
    return 'unknown';
  }

  // Check for Keycloak-specific properties
  if (userInfo['realm_access'] || userInfo['resource_access']) {
    return 'keycloak';
  }

  // Check for Auth0-specific properties
  if (
    userInfo['nickname'] !== undefined ||
    userInfo['user_metadata'] !== undefined ||
    userInfo['app_metadata'] !== undefined
  ) {
    return 'auth0';
  }

  // If we can't determine the provider, check for common patterns
  // Auth0 typically includes an issuer URL with "auth0.com"
  if (
    userInfo['iss'] &&
    typeof userInfo['iss'] === 'string' &&
    userInfo['iss'].includes('auth0.com')
  ) {
    return 'auth0';
  }

  // Keycloak typically includes an issuer URL with "auth/realms"
  if (
    userInfo['iss'] &&
    typeof userInfo['iss'] === 'string' &&
    userInfo['iss'].includes('/auth/realms')
  ) {
    return 'keycloak';
  }

  // If we still can't determine, return unknown
  return 'unknown';
}

/**
 * Transforms user data from any supported identity provider into the application's AuthUser format
 * @param userInfo - User information object from the provider
 * @returns A standardized AuthUser object
 */
export function transformUserFromProvider(userInfo: GenericUserInfo): AuthUser {
  const provider = detectProvider(userInfo);

  switch (provider) {
    case 'keycloak':
      return fromKeycloak(userInfo as KeycloakUserInfo);
    case 'auth0':
      return fromAuth0(userInfo as Auth0UserInfo);
    case 'unknown':
    default:
      // Fallback transformation for unknown providers
      // This provides a basic mapping that should work with most standard OIDC providers
      return {
        username:
          userInfo['preferred_username'] ||
          userInfo['nickname'] ||
          userInfo['email'] ||
          userInfo['sub'] ||
          '',
        fullName: userInfo['name'] || '',
        givenName: userInfo['given_name'] || '',
        familyName: userInfo['family_name'] || '',
        picture: userInfo['picture'],
        email: userInfo['email'],
        emailVerified: userInfo['email_verified'],
        locale: userInfo['locale'],
        lastLogin: userInfo['last_login'] || new Date().toISOString(),
        updatedAt: userInfo['updated_at'],
        createdAt: userInfo['created_at'],
        auth_id: userInfo['sub'],
        roles: userInfo['roles'] || [],
      };
  }
}
