import { describe, it, expect } from 'vitest';
import { detectProvider, transformUserFromProvider } from './detectProvider';

describe('Provider Detection', () => {
  it('should detect Keycloak provider from realm_access property', () => {
    const keycloakUser = {
      sub: 'user123',
      preferred_username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      realm_access: {
        roles: ['user']
      }
    };
    
    expect(detectProvider(keycloakUser)).toBe('keycloak');
  });

  it('should detect Auth0 provider from nickname property', () => {
    const auth0User = {
      sub: 'auth0|user123',
      nickname: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      picture: 'https://example.com/profile.jpg'
    };
    
    expect(detectProvider(auth0User)).toBe('auth0');
  });

  it('should detect Auth0 provider from app_metadata property', () => {
    const auth0User = {
      sub: 'auth0|user123',
      name: 'Test User',
      email: 'test@example.com',
      app_metadata: {
        roles: ['admin']
      }
    };
    
    expect(detectProvider(auth0User)).toBe('auth0');
  });

  it('should detect Keycloak from issuer URL', () => {
    const keycloakUser = {
      sub: 'user123',
      name: 'Test User',
      iss: 'https://keycloak.example.com/auth/realms/myrealm'
    };
    
    expect(detectProvider(keycloakUser)).toBe('keycloak');
  });

  it('should detect Auth0 from issuer URL', () => {
    const auth0User = {
      sub: 'user123',
      name: 'Test User',
      iss: 'https://example.auth0.com/'
    };
    
    expect(detectProvider(auth0User)).toBe('auth0');
  });

  it('should return unknown for unrecognized provider', () => {
    const genericUser = {
      sub: 'user123',
      name: 'Test User',
      email: 'test@example.com'
    };
    
    expect(detectProvider(genericUser)).toBe('unknown');
  });
});

describe('User Transformation', () => {
  it('should transform Keycloak user data correctly', () => {
    const keycloakUser = {
      sub: 'user123',
      preferred_username: 'testuser',
      name: 'Test User',
      given_name: 'Test',
      family_name: 'User',
      email: 'test@example.com',
      email_verified: true,
      realm_access: {
        roles: ['user']
      }
    };
    
    const transformed = transformUserFromProvider(keycloakUser);
    
    expect(transformed.username).toBe('testuser');
    expect(transformed.fullName).toBe('Test User');
    expect(transformed.email).toBe('test@example.com');
    expect(transformed.auth_id).toBe('user123');
  });

  it('should transform Auth0 user data correctly', () => {
    const auth0User = {
      sub: 'auth0|user123',
      nickname: 'testuser',
      name: 'Test User',
      given_name: 'Test',
      family_name: 'User',
      email: 'test@example.com',
      email_verified: true,
      picture: 'https://example.com/profile.jpg',
      updated_at: '2023-01-01T00:00:00Z',
      roles: ['admin']
    };
    
    const transformed = transformUserFromProvider(auth0User);
    
    expect(transformed.username).toBe('testuser');
    expect(transformed.fullName).toBe('Test User');
    expect(transformed.email).toBe('test@example.com');
    expect(transformed.picture).toBe('https://example.com/profile.jpg');
    expect(transformed.auth_id).toBe('auth0|user123');
    expect(transformed.roles).toEqual(['admin']);
  });

  it('should handle unknown provider with basic transformation', () => {
    const genericUser = {
      sub: 'user123',
      name: 'Generic User',
      email: 'generic@example.com'
    };
    
    const transformed = transformUserFromProvider(genericUser);
    
    expect(transformed.username).toBe('generic@example.com');
    expect(transformed.fullName).toBe('Generic User');
    expect(transformed.auth_id).toBe('user123');
  });
});
