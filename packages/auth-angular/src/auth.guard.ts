import { CanActivateFn, Router } from '@angular/router';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { AuthService } from './auth.service';

/**
 * Auth guard that checks if the user is authenticated
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const platformId = inject(PLATFORM_ID);

  if (isPlatformServer(platformId)) {
    return true;
  }

  return authService
    .waitForAuthentication()
    .then((isAuthenticated) => {
      if (isAuthenticated) {
        // User is authenticated, allow access
        return true;
      }

      // User is not authenticated, redirect to login
      authService.login(state.url);
      return false;
    })
    .catch(() => false);
};

/**
 * Role-based guard that checks if the user has the required roles
 */
export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (isPlatformServer(platformId)) {
    return true;
  }

  // Get required roles from route data
  const requiredRoles = route.data?.['roles'] as string[] | undefined;

  if (!requiredRoles || requiredRoles.length === 0) {
    // No specific roles required
    return true;
  }

  return authService
    .waitForAuthentication()
    .then((isAuthenticated) => {
      if (!isAuthenticated) {
        authService.login(state.url);
        return false;
      }

      // Check if user has any of the required roles
      if (authService.hasRoles(requiredRoles)) {
        return true;
      }

      // User doesn't have required roles, redirect to access denied
      router.navigate(['/access-denied']);
      return false;
    })
    .catch(() => false);
};
