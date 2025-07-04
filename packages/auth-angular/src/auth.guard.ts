import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Auth guard that checks if the user is authenticated
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);

  

  return authService.isAuthenticatedAsync().then((isAuthenticated) => {
    if (isAuthenticated) {
      // User is authenticated, allow access
      return true;
    } else {
      // User is not authenticated, redirect to login
      authService.login(state.url);
      return false;
    }
  });
};

/**
 * Role-based guard that checks if the user has the required roles
 */
export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Get required roles from route data
  const requiredRoles = route.data?.['roles'] as string[] | undefined;

  if (!requiredRoles || requiredRoles.length === 0) {
    // No specific roles required
    return true;
  }

  if (!authService.isAuthenticated()) {
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
};
