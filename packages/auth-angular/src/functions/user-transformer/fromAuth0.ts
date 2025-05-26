import { AuthUser } from "../../auth.service";

export type Auth0UserInfo = {
  // Core Identity Properties
  sub: string;              // Subject identifier (unique user ID)
  nickname: string;         // User nickname
  name: string;             // Full name
  given_name?: string;      // First name
  family_name?: string;     // Last name
  email?: string;           // Email address
  email_verified?: boolean; // Whether email has been verified
  picture?: string;         // URL to user's profile picture
  locale?: string;          // User's locale
  
  // Auth0 Specific Properties
  updated_at?: string;      // Last update timestamp
  created_at?: string;      // Creation timestamp
  last_login?: string;      // Last login timestamp
  
  // Access Control Properties
  roles?: string[];         // User roles (if using Auth0 RBAC)
  permissions?: string[];   // User permissions (if using Auth0 RBAC)
  
  // Additional Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user_metadata?: Record<string, any>;  // User editable metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app_metadata?: Record<string, any>;   // Application metadata (controlled by apps/APIs)
  
  // Standard OIDC properties
  iss?: string;             // Issuer
  aud?: string;             // Audience
  iat?: number;             // Issued at timestamp
  exp?: number;             // Expiration timestamp
}

/**
 * Transforms an Auth0 user object into the application's AuthUser format
 * @param auth0User - The user object from Auth0
 * @returns A standardized AuthUser object
 */
export function fromAuth0(auth0User: Auth0UserInfo): AuthUser {
  return {
    username: auth0User.nickname || auth0User.email || '',
    fullName: auth0User.name || '',
    givenName: auth0User.given_name || '',
    familyName: auth0User.family_name || '',
    picture: auth0User.picture,
    email: auth0User.email,
    emailVerified: auth0User.email_verified,
    locale: auth0User.locale,
    lastLogin: auth0User.last_login,
    updatedAt: auth0User.updated_at,
    createdAt: auth0User.created_at,
    auth_id: auth0User.sub,
    // If roles are stored directly or in app_metadata
    roles: auth0User.roles || auth0User.app_metadata?.["roles"],
  };
}
