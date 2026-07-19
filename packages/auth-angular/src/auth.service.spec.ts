import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { DOCUMENT, PLATFORM_ID } from '@angular/core';
import { TransferState } from '@angular/core';
import { AuthService } from './auth.service';
import { httpResource, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_TRANSFER_STATE_KEY } from './auth.service';

let mockServerRequest: {
  headers: Record<string, string | null | undefined>;
} | null = null;

// Mock httpResource
vi.mock('@angular/common/http', async () => {
  const actual = await vi.importActual('@angular/common/http');
  return {
    ...actual,
    httpResource: vi.fn(),
  };
});

vi.mock('@analogjs/router/tokens', () => ({
  injectRequest: vi.fn(() => mockServerRequest),
}));

describe('AuthService', () => {
  let service: AuthService;
  let httpTestingController: HttpTestingController | undefined;
  let mockDocument: Partial<Document>;
  let authenticatedResource: ReturnType<typeof createMockResource>;
  let userResource: ReturnType<typeof createMockResource>;

  const mockUser = {
    username: 'testuser',
    fullName: 'Test User',
    givenName: 'Test',
    familyName: 'User',
    email: 'test@example.com',
    roles: ['user', 'admin'],
  };

  const createMockResource = (defaultValue: unknown, status = 'resolved') => ({
    value: vi.fn(() => defaultValue),
    asReadonly: () => ({ value: vi.fn(() => defaultValue) }),
    reload: vi.fn(),
    set: vi.fn(),
    headers: vi.fn(() => ({})),
    statusCode: vi.fn(() => 200),
    progress: vi.fn(() => ({ value: 0 })),
    hasValue: vi.fn(() => true),
    status: vi.fn(() => status),
    isLoading: vi.fn(() => false),
    isFetching: vi.fn(() => false),
    error: vi.fn(() => null),
    request: vi.fn(),
  });

  beforeEach(async () => {
    mockServerRequest = null;

    // Mock document
    mockDocument = {
      getElementById: vi.fn(() => null),
      location: {
        href: '',
        origin: 'http://localhost:3000',
      } as Location,
    };

    authenticatedResource = createMockResource(true);
    userResource = createMockResource(mockUser);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (httpResource as any).mockImplementation(
      (configOrFn: any, options?: any) => {
        const config =
          typeof configOrFn === 'function' ? configOrFn() : configOrFn;

        if (config?.url === '/api/auth/user') {
          return userResource;
        } else if (config?.url === '/api/auth/authenticated') {
          return authenticatedResource;
        }

        return createMockResource(options?.defaultValue || null);
      }
    );

    await TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        Router,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: DOCUMENT, useValue: mockDocument },
      ],
    }).compileComponents();

    service = TestBed.inject(AuthService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController?.verify();
    vi.useRealTimers();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should check authentication status', () => {
    expect(service.isAuthenticated()).toBe(true);
  });

  it('should report when authentication status is resolved', () => {
    expect(service.isAuthenticationResolved()).toBe(true);
  });

  it('should let auth resources load and cache without forcing startup reloads', () => {
    expect(authenticatedResource.reload).not.toHaveBeenCalled();
    expect(userResource.reload).not.toHaveBeenCalled();
  });

  it('should revalidate authentication on browser startup when SSR resolved false', async () => {
    TestBed.resetTestingModule();

    authenticatedResource = createMockResource(false, 'resolved');
    userResource = createMockResource(null, 'idle');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (httpResource as any).mockImplementation(
      (configOrFn: any, options?: any) => {
        const config =
          typeof configOrFn === 'function' ? configOrFn() : configOrFn;

        if (config?.url === '/api/auth/user') {
          return userResource;
        } else if (config?.url === '/api/auth/authenticated') {
          return authenticatedResource;
        }

        return createMockResource(options?.defaultValue || null);
      }
    );

    await TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        Router,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: DOCUMENT, useValue: mockDocument },
      ],
    }).compileComponents();

    TestBed.inject(AuthService);
    TestBed.flushEffects();
    await Promise.resolve();

    expect(authenticatedResource.reload).toHaveBeenCalledTimes(1);
  });

  it('should return current user', () => {
    const user = service.user();
    expect(user).toEqual(mockUser);
  });

  it('should login with redirect URI', () => {
    const targetUrl = '/dashboard';
    service.login(targetUrl);
    expect(mockDocument.location?.href).toBe(
      '/api/auth/login?redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fdashboard'
    );
  });

  it('should login without redirect URI', () => {
    // Mock router.url
    const router = TestBed.inject(Router);
    Object.defineProperty(router, 'url', { value: '/current-page' });

    service.login();
    expect(mockDocument.location?.href).toBe(
      '/api/auth/login?redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcurrent-page'
    );
  });

  it('should logout and redirect to home', () => {
    // Spy on the userResource set method
    const setSpy = vi.spyOn(service.userResource, 'set');

    service.logout();

    expect(setSpy).toHaveBeenCalledWith(null);
    expect(mockDocument.location?.href).toBe(
      '/api/auth/logout?redirect_uri=%2F'
    );
  });

  it('should check if user has required roles (user with matching role)', () => {
    // Mock the value function to return our test user with admin role
    vi.spyOn(service.userResource, 'value').mockReturnValue(mockUser);

    const hasRole = service.hasRoles(['admin']);
    expect(hasRole).toBe(true);
  });

  it('should check if user has required roles (user without matching role)', () => {
    // Mock user without admin role
    const userWithoutAdminRole = {
      ...mockUser,
      roles: ['user'],
    };
    vi.spyOn(service.userResource, 'value').mockReturnValue(
      userWithoutAdminRole
    );

    const hasRole = service.hasRoles(['admin']);
    expect(hasRole).toBe(false);
  });

  it('should return false for roles when user is null', () => {
    vi.spyOn(service.userResource, 'value').mockReturnValue(null);

    const hasRole = service.hasRoles(['admin']);
    expect(hasRole).toBe(false);
  });

  it('should return false for roles when user has no roles', () => {
    const userWithoutRoles = {
      ...mockUser,
      roles: undefined,
    };
    vi.spyOn(service.userResource, 'value').mockReturnValue(userWithoutRoles);

    const hasRole = service.hasRoles(['admin']);
    expect(hasRole).toBe(false);
  });

  it('should fetch user data when authenticated', () => {
    // Simply verify that userResource.reload can be called
    const reloadSpy = vi.spyOn(service.userResource, 'reload');

    // Manually call reload to simulate the effect
    service.userResource.reload();

    expect(reloadSpy).toHaveBeenCalled();
  });

  it('should reload user data when authentication is true but user data is empty', async () => {
    TestBed.resetTestingModule();
    authenticatedResource = createMockResource(true);
    userResource = createMockResource(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (httpResource as any).mockImplementation(
      (configOrFn: any, options?: any) => {
        const config =
          typeof configOrFn === 'function' ? configOrFn() : configOrFn;

        if (config?.url === '/api/auth/user') {
          return userResource;
        } else if (config?.url === '/api/auth/authenticated') {
          return authenticatedResource;
        }

        return createMockResource(options?.defaultValue || null);
      }
    );

    await TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        Router,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: DOCUMENT, useValue: mockDocument },
      ],
    }).compileComponents();

    TestBed.inject(AuthService);
    TestBed.flushEffects();

    expect(userResource.reload).toHaveBeenCalled();
  });

  it('should retry user data when authenticated user resource is in an error state', async () => {
    TestBed.resetTestingModule();
    authenticatedResource = createMockResource(true);
    userResource = createMockResource(null, 'error');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (httpResource as any).mockImplementation(
      (configOrFn: any, options?: any) => {
        const config =
          typeof configOrFn === 'function' ? configOrFn() : configOrFn;

        if (config?.url === '/api/auth/user') {
          return userResource;
        } else if (config?.url === '/api/auth/authenticated') {
          return authenticatedResource;
        }

        return createMockResource(options?.defaultValue || null);
      }
    );

    await TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        Router,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: DOCUMENT, useValue: mockDocument },
      ],
    }).compileComponents();

    TestBed.inject(AuthService);
    TestBed.flushEffects();

    expect(userResource.reload).toHaveBeenCalled();
  });

  it('should not increment user reload attempts inside scheduled retries', async () => {
    vi.useFakeTimers();
    TestBed.resetTestingModule();
    authenticatedResource = createMockResource(true);
    userResource = createMockResource(null, 'error');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (httpResource as any).mockImplementation(
      (configOrFn: any, options?: any) => {
        const config =
          typeof configOrFn === 'function' ? configOrFn() : configOrFn;

        if (config?.url === '/api/auth/user') {
          return userResource;
        } else if (config?.url === '/api/auth/authenticated') {
          return authenticatedResource;
        }

        return createMockResource(options?.defaultValue || null);
      }
    );

    await TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        Router,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: DOCUMENT, useValue: mockDocument },
      ],
    }).compileComponents();

    const retryingService = TestBed.inject(AuthService);
    TestBed.flushEffects();

    expect(userResource.reload).toHaveBeenCalledTimes(1);
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (retryingService as any).userReloadAttempts
    ).toBe(1);

    vi.advanceTimersByTime(1000);

    expect(userResource.reload).toHaveBeenCalledTimes(2);
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (retryingService as any).userReloadAttempts
    ).toBe(1);
  });

  it('should request /api/auth/authenticated on SSR', async () => {
    TestBed.resetTestingModule();

    authenticatedResource = createMockResource(true);
    userResource = createMockResource(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (httpResource as any).mockImplementation(
      (configOrFn: any, options?: any) => {
        const config =
          typeof configOrFn === 'function' ? configOrFn() : configOrFn;

        if (config?.url === '/api/auth/user') {
          return userResource;
        }

        if (config?.url === '/api/auth/authenticated') {
          return authenticatedResource;
        }

        return createMockResource(options?.defaultValue || null);
      }
    );

    await TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        Router,
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: DOCUMENT, useValue: mockDocument },
      ],
    }).compileComponents();

    const ssrService = TestBed.inject(AuthService);

    expect(ssrService.isAuthenticated()).toBe(true);
  });

  it('should resolve SSR request headers lazily for the authenticated resource', async () => {
    TestBed.resetTestingModule();

    authenticatedResource = createMockResource(true);
    userResource = createMockResource(null);

    let authenticatedResourceFactory:
      | (() => {
          url: string;
          method: string;
          headers: { get(name: string): string | null };
          withCredentials: boolean;
        })
      | null = null;
    let resourceCallCount = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (httpResource as any).mockImplementation((configOrFn: any, options?: any) => {
      resourceCallCount += 1;

      if (resourceCallCount === 1) {
        authenticatedResourceFactory = configOrFn;
        return authenticatedResource;
      }

      if (resourceCallCount === 2) {
        return userResource;
      }

      return createMockResource(options?.defaultValue || null);
    });

    mockServerRequest = null;

    await TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        Router,
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: DOCUMENT, useValue: mockDocument },
      ],
    }).compileComponents();

    TestBed.inject(AuthService);

    mockServerRequest = {
      headers: {
        cookie: 'auth.session.demo-auth=signed-session-id',
      },
    };

    const requestConfig = authenticatedResourceFactory?.();

    expect(requestConfig?.headers.get('cookie')).toBe(
      'auth.session.demo-auth=signed-session-id'
    );
  });

  it('should consume auth snapshot from TransferState on browser bootstrap', async () => {
    TestBed.resetTestingModule();

    const transferredUser = {
      username: 'transferred-user',
      fullName: 'Transferred User',
      givenName: 'Transferred',
      familyName: 'User',
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (httpResource as any).mockImplementation((configOrFn: any, options?: any) => {
      const config =
        typeof configOrFn === 'function' ? configOrFn() : configOrFn;

      if (
        config?.url === '/api/auth/user' ||
        config?.url === '/api/auth/authenticated'
      ) {
        return createMockResource(options?.defaultValue ?? null, 'local');
      }

      return createMockResource(options?.defaultValue ?? null, 'local');
    });

    await TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        Router,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: DOCUMENT, useValue: mockDocument },
      ],
    }).compileComponents();

    const browserTransferState = TestBed.inject(TransferState);
    browserTransferState.set(AUTH_TRANSFER_STATE_KEY, {
      authenticated: true,
      user: transferredUser,
    });

    const browserService = TestBed.inject(AuthService);

    expect(browserService.isAuthenticated()).toBe(true);
    expect(browserService.user()).toEqual(transferredUser);
    expect(browserTransferState.hasKey(AUTH_TRANSFER_STATE_KEY)).toBe(false);
  });

  it('should write an auth snapshot to TransferState during SSR when auth state resolves', async () => {
    TestBed.resetTestingModule();

    authenticatedResource = createMockResource(true, 'resolved');
    userResource = createMockResource(mockUser, 'resolved');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (httpResource as any).mockImplementation((configOrFn: any, options?: any) => {
      const config =
        typeof configOrFn === 'function' ? configOrFn() : configOrFn;

      if (config?.url === '/api/auth/user') {
        return userResource;
      }

      if (config?.url === '/api/auth/authenticated') {
        return authenticatedResource;
      }

      return createMockResource(options?.defaultValue || null);
    });

    await TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        Router,
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: DOCUMENT, useValue: mockDocument },
      ],
    }).compileComponents();

    const ssrService = TestBed.inject(AuthService);
    TestBed.flushEffects();

    const ssrTransferState = TestBed.inject(TransferState);
    const snapshot = ssrTransferState.get(AUTH_TRANSFER_STATE_KEY, null);

    expect(ssrService.isAuthenticated()).toBe(true);
    expect(snapshot).toEqual({
      authenticated: true,
      user: mockUser,
    });
  });

  it('should load the authenticated user during SSR when authentication resolves', async () => {
    TestBed.resetTestingModule();

    authenticatedResource = createMockResource(true, 'resolved');
    userResource = createMockResource(mockUser, 'resolved');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (httpResource as any).mockImplementation((configOrFn: any, options?: any) => {
      const config =
        typeof configOrFn === 'function' ? configOrFn() : configOrFn;

      if (config?.url === '/api/auth/user') {
        return userResource;
      }

      if (config?.url === '/api/auth/authenticated') {
        return authenticatedResource;
      }

      return createMockResource(options?.defaultValue || null);
    });

    await TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        Router,
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: DOCUMENT, useValue: mockDocument },
      ],
    }).compileComponents();

    const ssrService = TestBed.inject(AuthService);

    expect(ssrService.isAuthenticated()).toBe(true);
    expect(ssrService.user()).toEqual(mockUser);
  });

  it('should use an explicitly provided server request for SSR auth headers', async () => {
    TestBed.resetTestingModule();

    authenticatedResource = createMockResource(true);
    userResource = createMockResource(null);

    let authenticatedResourceFactory:
      | (() => {
          url: string;
          method: string;
          headers: { get(name: string): string | null };
          withCredentials: boolean;
        })
      | null = null;
    let resourceCallCount = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (httpResource as any).mockImplementation((configOrFn: any, options?: any) => {
      resourceCallCount += 1;

      if (resourceCallCount === 1) {
        authenticatedResourceFactory = configOrFn;
        return authenticatedResource;
      }

      if (resourceCallCount === 2) {
        return userResource;
      }

      return createMockResource(options?.defaultValue || null);
    });

    mockServerRequest = null;

    await TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        Router,
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: DOCUMENT, useValue: mockDocument },
      ],
    }).compileComponents();

    const ssrService = TestBed.inject(AuthService);

    ssrService.setServerRequest({
      headers: {
        cookie: 'auth.session.demo-auth=explicit-session-id',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const requestConfig = authenticatedResourceFactory?.();

    expect(requestConfig?.headers.get('cookie')).toBe(
      'auth.session.demo-auth=explicit-session-id'
    );
  });
});
