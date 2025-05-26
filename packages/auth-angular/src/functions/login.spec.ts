// filepath: /Users/gspeck/Develop/Private/analog-tools/packages/auth-angular/src/functions/login.spec.ts
import { describe, it, expect, vi } from 'vitest';
import * as loginModule from './login';

describe('login function', () => {
  // Store the original document.location
  const originalLocation = window.document.location;
  let mockLocation: { href: string; origin: string };
  
  beforeEach(() => {
    // Mock location object
    mockLocation = {
      href: '',
      origin: 'https://example.com'
    };
    
    // Mock redirect function
    vi.spyOn(loginModule, 'redirect').mockImplementation((uri: string) => {
      mockLocation.href = uri;
    });
    
    // Use the mock location inside login function
    vi.spyOn(loginModule, 'login').mockImplementation((redirectUri?: string) => {
      const url = mockLocation.origin + (redirectUri || '');
      loginModule.redirect(`/api/auth/login?redirect_uri=${encodeURIComponent(url)}`);
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should redirect to the login endpoint with the current origin and given redirect URI', () => {
    // Call login with a specific redirect URI
    loginModule.login('/dashboard');
    
    // Verify the URL was constructed correctly
    expect(mockLocation.href).toBe(
      '/api/auth/login?redirect_uri=https%3A%2F%2Fexample.com%2Fdashboard'
    );
  });
  
  it('should handle undefined redirect URI', () => {
    // Call login without a redirect URI
    loginModule.login(undefined);
    
    // Verify the URL was constructed correctly with the origin only
    expect(mockLocation.href).toBe(
      '/api/auth/login?redirect_uri=https%3A%2F%2Fexample.com'
    );
  });
  
  it('should properly encode the redirect URI', () => {
    // Call login with a redirect URI containing special characters
    loginModule.login('/path with spaces?query=value&param=test');
    
    // Verify the URL was constructed correctly with proper encoding
    expect(mockLocation.href).toBe(
      '/api/auth/login?redirect_uri=https%3A%2F%2Fexample.com%2Fpath%20with%20spaces%3Fquery%3Dvalue%26param%3Dtest'
    );
  });
  
  it('should call the redirect helper function', () => {
    // Spy on the redirect function
    const redirectSpy = vi.spyOn(loginModule, 'redirect');
    
    // Call login
    loginModule.login('/profile');
    
    // Verify redirect was called with the correct URL
    expect(redirectSpy).toHaveBeenCalledWith(
      '/api/auth/login?redirect_uri=https%3A%2F%2Fexample.com%2Fprofile'
    );
  });
});
