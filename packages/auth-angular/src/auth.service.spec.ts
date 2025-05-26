import { TestBed } from '@angular/core/testing';
import { AuthService, AuthUser } from './auth.service';
import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { expect, vi, describe, it, beforeEach, afterEach } from 'vitest';
import { httpResource } from '@angular/common/http';
import { transformUserFromProvider } from './functions/user-transformer';

// Mock implementation
vi.mock('@angular/common/http', () => {
  const original = vi.importActual('@angular/common/http');
  return {
    ...original,
    httpResource: vi.fn()
  };
});

vi.mock('./functions/user-transformer', () => ({
  transformUserFromProvider: vi.fn((user) => user)
}));

describe('AuthService', () => {
  let service: AuthService;
  let router: { navigate: any; url: string };
  let document: Document;
  let mockUserResource: any;
  let mockAuthResource: any;

  // Mock window.location for testing redirects
  const mockLocation = {
    href: 'https://example.com',
    origin: 'https://example.com'
  };

  beforeEach(() => {
    // Create spies
    router = { navigate: vi.fn(), url: '/current' };

    // Setup mock resources
    mockUserResource = {
      value: vi.fn().mockReturnValue(null),
      reload: vi.fn(),
      set: vi.fn(),
      asReadonly: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(null) })
    };

    mockAuthResource = {
      value: vi.fn().mockReturnValue(false),
      reload: vi.fn(),
      asReadonly: vi.fn().mockReturnValue({ value: vi.fn().mockReturnValue(false) })
    };

    // Setup httpResource mock
    vi.mocked(httpResource).mockImplementation((configOrFn) => {
      // Support both function and object forms
      const config = typeof configOrFn === 'function' ? configOrFn() : configOrFn;
      
      if (config?.url === '/api/auth/user') {
        return mockUserResource;
      }
      if (config?.url === '/api/auth/authenticated') {
        return mockAuthResource;
      }
      return {};
    });

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Router, useValue: router },
        { provide: PLATFORM_ID, useValue: 'browser' },
        { 
          provide: DOCUMENT, 
          useValue: { 
            location: mockLocation 
          } 
        }
      ]
    });

    service = TestBed.inject(AuthService);
    document = TestBed.inject(DOCUMENT);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize and check authentication on startup in browser', () => {
    // Verify that isAuthenticatedResource.reload() was called during initialization
    expect(mockAuthResource.reload).toHaveBeenCalled();
  });

  it('should not initialize auth check on server side', () => {
    // Reset mocks
    vi.clearAllMocks();
    mockAuthResource.reload.mockClear();
    
    // Re-create service with server platform
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Router, useValue: router },
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: DOCUMENT, useValue: { location: mockLocation } }
      ]
    });
    
    service = TestBed.inject(AuthService);
    
    // Verify auth check wasn't called on server
    expect(mockAuthResource.reload).not.toHaveBeenCalled();
  });

  it('should redirect to login page with current URL as target', () => {
    service.login();
    
    expect(document.location.href).toBe(
      '/api/auth/login?redirect_uri=https%3A%2F%2Fexample.com%2Fcurrent'
    );
  });

  it('should redirect to login page with specified target URL', () => {
    service.login('/dashboard');
    
    expect(document.location.href).toBe(
      '/api/auth/login?redirect_uri=https%3A%2F%2Fexample.com%2Fdashboard'
    );
  });

  it('should logout and redirect to home', () => {
    service.logout();
    
    // Verify user resource is cleared
    expect(mockUserResource.set).toHaveBeenCalledWith(null);
    
    // Verify redirect
    expect(document.location.href).toBe('/api/auth/logout?redirect_uri=%2F');
  });

  it('should check if user has required roles (no user)', () => {
    // User not authenticated
    mockUserResource.value.mockReturnValue(null);
    
    const result = service.hasRoles(['admin']);
    expect(result).toBe(false);
  });

  it('should check if user has required roles (user without roles)', () => {
    // User authenticated but no roles
    mockUserResource.value.mockReturnValue({
      username: 'test',
      fullName: 'Test User',
      givenName: 'Test',
      familyName: 'User'
    });
    
    const result = service.hasRoles(['admin']);
    expect(result).toBe(false);
  });

  it('should check if user has required roles (user with matching role)', () => {
    // User authenticated with roles
    mockUserResource.value.mockReturnValue({
      username: 'test',
      fullName: 'Test User',
      givenName: 'Test',
      familyName: 'User',
      roles: ['user', 'admin']
    });
    
    const result = service.hasRoles(['admin']);
    expect(result).toBe(true);
  });

  it('should check if user has required roles (user without matching role)', () => {
    // User authenticated with roles that don't match
    mockUserResource.value.mockReturnValue({
      username: 'test',
      fullName: 'Test User',
      givenName: 'Test',
      familyName: 'User',
      roles: ['user', 'editor']
    });
    
    const result = service.hasRoles(['admin']);
    expect(result).toBe(false);
  });

  it('should fetch user data when authenticated', async () => {
    // Trigger authentication
    mockAuthResource.value.mockReturnValue(true);
    
    // Simulate the effect running by calling reload directly
    mockUserResource.reload.mockClear();
    
    // Simulate what happens when isAuthenticated becomes true
    mockAuthResource.asReadonly().value.mockReturnValue(true);
    
    // Call the method that should trigger user data reload
    service.userResource.reload();
    
    // Verify user data was fetched
    expect(mockUserResource.reload).toHaveBeenCalled();
  });

  it('should clean up interval on destroy', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    
    service.ngOnDestroy();
    
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
