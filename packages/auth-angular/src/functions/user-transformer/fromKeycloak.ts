import { AuthUser } from "../../auth.service";

export type KeycloakUserInfo = {
  // Core Identity Properties
  sub: string;              // Subject identifier (unique user ID)
  preferred_username: string;  // Username
  name: string;             // Full name
  given_name: string;       // First name
  family_name: string;      // Last name
  email: string;            // Email address
  email_verified: boolean;  // Whether email has been verified
  
  // Access Control Properties
  realm_access: {
    roles: string[]         // Realm-level roles assigned to user
  };
  resource_access: {        // Client-specific roles
    [clientId: string]: {
      roles: string[]
    }
  };
  
  // Additional Metadata
  groups: string[];         // Groups the user belongs to
  scope: string;            // OAuth scopes granted
  sid: string;              // Session ID
  acr: string;              // Authentication context class reference
  iat: number;              // Issued at timestamp
  exp: number;              // Expiration timestamp
  auth_time: number;        // Time when authentication occurred
}


export function fromKeycloak (keycloakUser: KeycloakUserInfo): AuthUser {
  return {
    username: keycloakUser.preferred_username,
    fullName: keycloakUser.name,
    givenName: keycloakUser.given_name,
    familyName: keycloakUser.family_name,
    picture: undefined,
    email: keycloakUser.email,
    emailVerified: keycloakUser.email_verified,
    locale: undefined, // Locale is not provided in Keycloak user info
    lastLogin: new Date().toISOString(), // Assuming last login is now
    updatedAt: undefined, // Assuming updated at is now
    createdAt: undefined, // Assuming created at is now
    auth_id: keycloakUser.sub, // Using sub as auth_id
  };
}