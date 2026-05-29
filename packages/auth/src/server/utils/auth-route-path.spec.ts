import { describe, expect, it } from 'vitest';
import { isAuthRoutePath, normalizeAuthPath } from './auth-route-path';

describe('isAuthRoutePath', () => {
  it('recognizes /api/auth/login', () => {
    expect(isAuthRoutePath('/api/auth/login')).toBe(true);
  });

  it('recognizes /auth/login (h3-stripped alias)', () => {
    expect(isAuthRoutePath('/auth/login')).toBe(true);
  });

  it('rejects /api/users', () => {
    expect(isAuthRoutePath('/api/users')).toBe(false);
  });

  it('rejects /login', () => {
    expect(isAuthRoutePath('/login')).toBe(false);
  });
});

describe('normalizeAuthPath', () => {
  it('maps /auth/login → /api/auth/login', () => {
    expect(normalizeAuthPath('/auth/login')).toBe('/api/auth/login');
  });

  it('leaves /api/auth/callback unchanged', () => {
    expect(normalizeAuthPath('/api/auth/callback')).toBe('/api/auth/callback');
  });

  it('leaves /api/users unchanged', () => {
    expect(normalizeAuthPath('/api/users')).toBe('/api/users');
  });
});
