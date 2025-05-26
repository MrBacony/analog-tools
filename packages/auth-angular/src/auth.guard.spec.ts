import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { authGuard, roleGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { expect, vi, describe, it, beforeEach } from 'vitest';

describe('Auth Guards', () => {
  let authService: { isAuthenticated: any; login: any; hasRoles: any };
  let router: { navigate: any; url: string };
  
  beforeEach(() => {
    authService = {
      isAuthenticated: vi.fn(),
      login: vi.fn(),
      hasRoles: vi.fn()
    };
    router = {
      navigate: vi.fn(),
      url: '/current'
    };
    
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router }
      ]
    });
  });

  describe('authGuard', () => {
    it('should allow access when user is authenticated', () => {
      authService.isAuthenticated.mockReturnValue(true);
      
      const route = {} as unknown as ActivatedRouteSnapshot;
      const state = { url: '/profile' } as unknown as RouterStateSnapshot;
      
      const result = TestBed.runInInjectionContext(() => authGuard(route, state));
      
      expect(result).toBe(true);
    });
    
    it('should redirect to login when user is not authenticated', () => {
      authService.isAuthenticated.mockReturnValue(false);
      
      const route = {} as unknown as ActivatedRouteSnapshot;
      const state = { url: '/profile' } as unknown as RouterStateSnapshot;
      
      const result = TestBed.runInInjectionContext(() => authGuard(route, state));
      
      expect(result).toBe(false);
      expect(authService.login).toHaveBeenCalledWith('/profile');
    });
  });
  
  describe('roleGuard', () => {
    it('should allow access when no roles are required', () => {
      const route = { data: {} } as unknown as ActivatedRouteSnapshot;
      const state = { url: '/profile' } as unknown as RouterStateSnapshot;
      
      const result = TestBed.runInInjectionContext(() => roleGuard(route, state));
      
      expect(result).toBe(true);
    });
    
    it('should allow access when user has required roles', () => {
      authService.isAuthenticated.mockReturnValue(true);
      authService.hasRoles.mockReturnValue(true);
      
      const route = { data: { roles: ['admin'] } } as unknown as ActivatedRouteSnapshot;
      const state = { url: '/admin' } as unknown as RouterStateSnapshot;
      
      const result = TestBed.runInInjectionContext(() => roleGuard(route, state));
      
      expect(result).toBe(true);
      expect(authService.hasRoles).toHaveBeenCalledWith(['admin']);
    });
    
    it('should redirect to login when user is not authenticated', () => {
      authService.isAuthenticated.mockReturnValue(false);
      
      const route = { data: { roles: ['admin'] } } as unknown as ActivatedRouteSnapshot;
      const state = { url: '/admin' } as unknown as RouterStateSnapshot;
      
      const result = TestBed.runInInjectionContext(() => roleGuard(route, state));
      
      expect(result).toBe(false);
      expect(authService.login).toHaveBeenCalledWith('/admin');
    });
    
    it('should redirect to access-denied when user lacks required roles', () => {
      authService.isAuthenticated.mockReturnValue(true);
      authService.hasRoles.mockReturnValue(false);
      
      const route = { data: { roles: ['admin'] } } as unknown as ActivatedRouteSnapshot;
      const state = { url: '/admin' } as unknown as RouterStateSnapshot;
      
      const result = TestBed.runInInjectionContext(() => roleGuard(route, state));
      
      expect(result).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/access-denied']);
    });
  });
});
