import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { authGuard, roleGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PLATFORM_ID } from '@angular/core';

type AuthServiceGuardMock = Pick<
  AuthService,
  'waitForAuthentication' | 'login' | 'hasRoles'
>;

type RouterMock = Pick<Router, 'navigate' | 'url'>;

describe('Auth Guards', () => {
  let authService: {
    waitForAuthentication: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    hasRoles: ReturnType<typeof vi.fn>;
  } & AuthServiceGuardMock;
  let router: {
    navigate: ReturnType<typeof vi.fn>;
    url: string;
  } & RouterMock;

  beforeEach(() => {
    authService = {
      waitForAuthentication: vi.fn(),
      login: vi.fn(),
      hasRoles: vi.fn(),
    };
    router = {
      navigate: vi.fn(),
      url: '/current',
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
  });

  describe('authGuard', () => {
    it('should allow access when user is authenticated', async () => {
      authService.waitForAuthentication.mockResolvedValue(true);

      const route = {} as unknown as ActivatedRouteSnapshot;
      const state = { url: '/profile' } as unknown as RouterStateSnapshot;

      const result = await TestBed.runInInjectionContext(() =>
        authGuard(route, state)
      );

      expect(result).toBe(true);
    });

    it('should redirect to login when user is not authenticated', async () => {
      authService.waitForAuthentication.mockResolvedValue(false);

      const route = {} as unknown as ActivatedRouteSnapshot;
      const state = { url: '/profile' } as unknown as RouterStateSnapshot;

      const result = await TestBed.runInInjectionContext(() =>
        authGuard(route, state)
      );

      expect(result).toBe(false);
      expect(authService.login).toHaveBeenCalledWith('/profile');
    });

    it('should deny access without redirecting when authentication check rejects', async () => {
      authService.waitForAuthentication.mockRejectedValue(
        new Error('Auth check failed')
      );

      const route = {} as unknown as ActivatedRouteSnapshot;
      const state = { url: '/profile' } as unknown as RouterStateSnapshot;

      const result = await TestBed.runInInjectionContext(() =>
        authGuard(route, state)
      );

      expect(result).toBe(false);
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('should allow access without checking authentication on the server', () => {
      TestBed.overrideProvider(PLATFORM_ID, { useValue: 'server' });

      const route = {} as unknown as ActivatedRouteSnapshot;
      const state = { url: '/profile' } as unknown as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() =>
        authGuard(route, state)
      );

      expect(result).toBe(true);
      expect(authService.waitForAuthentication).not.toHaveBeenCalled();
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('should wait for the initial authentication check before redirecting', async () => {
      let resolveAuthentication!: (value: boolean) => void;
      authService.waitForAuthentication.mockReturnValue(
        new Promise<boolean>((resolve) => {
          resolveAuthentication = resolve;
        })
      );

      const route = {} as unknown as ActivatedRouteSnapshot;
      const state = { url: '/profile' } as unknown as RouterStateSnapshot;

      const resultPromise = TestBed.runInInjectionContext(() =>
        authGuard(route, state)
      );

      expect(authService.login).not.toHaveBeenCalled();

      resolveAuthentication(false);
      const result = await resultPromise;

      expect(result).toBe(false);
      expect(authService.login).toHaveBeenCalledWith('/profile');
    });
  });

  describe('roleGuard', () => {
    it('should allow access when no roles are required', () => {
      const route = { data: {} } as unknown as ActivatedRouteSnapshot;
      const state = { url: '/profile' } as unknown as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() =>
        roleGuard(route, state)
      );

      expect(result).toBe(true);
    });

    it('should allow access when user has required roles', async () => {
      authService.waitForAuthentication.mockResolvedValue(true);
      authService.hasRoles.mockReturnValue(true);

      const route = {
        data: { roles: ['admin'] },
      } as unknown as ActivatedRouteSnapshot;
      const state = { url: '/admin' } as unknown as RouterStateSnapshot;

      const result = await TestBed.runInInjectionContext(() =>
        roleGuard(route, state)
      );

      expect(result).toBe(true);
      expect(authService.hasRoles).toHaveBeenCalledWith(['admin']);
    });

    it('should redirect to login when user is not authenticated', async () => {
      authService.waitForAuthentication.mockResolvedValue(false);

      const route = {
        data: { roles: ['admin'] },
      } as unknown as ActivatedRouteSnapshot;
      const state = { url: '/admin' } as unknown as RouterStateSnapshot;

      const result = await TestBed.runInInjectionContext(() =>
        roleGuard(route, state)
      );

      expect(result).toBe(false);
      expect(authService.login).toHaveBeenCalledWith('/admin');
    });

    it('should deny access without redirecting when role authentication check rejects', async () => {
      authService.waitForAuthentication.mockRejectedValue(
        new Error('Auth check failed')
      );

      const route = {
        data: { roles: ['admin'] },
      } as unknown as ActivatedRouteSnapshot;
      const state = { url: '/admin' } as unknown as RouterStateSnapshot;

      const result = await TestBed.runInInjectionContext(() =>
        roleGuard(route, state)
      );

      expect(result).toBe(false);
      expect(authService.login).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should redirect to access-denied when user lacks required roles', async () => {
      authService.waitForAuthentication.mockResolvedValue(true);
      authService.hasRoles.mockReturnValue(false);

      const route = {
        data: { roles: ['admin'] },
      } as unknown as ActivatedRouteSnapshot;
      const state = { url: '/admin' } as unknown as RouterStateSnapshot;

      const result = await TestBed.runInInjectionContext(() =>
        roleGuard(route, state)
      );

      expect(result).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/access-denied']);
    });

    it('should allow access without checking authentication on the server', () => {
      TestBed.overrideProvider(PLATFORM_ID, { useValue: 'server' });

      const route = {
        data: { roles: ['admin'] },
      } as unknown as ActivatedRouteSnapshot;
      const state = { url: '/admin' } as unknown as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() =>
        roleGuard(route, state)
      );

      expect(result).toBe(true);
      expect(authService.waitForAuthentication).not.toHaveBeenCalled();
      expect(authService.login).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
