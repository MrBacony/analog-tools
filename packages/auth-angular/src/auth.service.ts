import {
  DOCUMENT,
  effect,
  inject,
  Injectable,
  OnDestroy,
  PLATFORM_ID,
} from '@angular/core';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import {
  GenericUserInfo,
  transformUserFromProvider,
} from './functions/user-transformer';
import { getRequestHeaders } from './functions/utils/get-request-headers';
import { injectRequest } from '@analogjs/router/tokens';

export interface AuthUser {
  username: string;
  fullName: string;
  givenName: string;
  familyName: string;
  picture?: string;
  email?: string;
  emailVerified?: boolean;
  locale?: string;
  lastLogin?: string;
  updatedAt?: string;
  createdAt?: string;
  auth_id?: string;
  roles?: string[];
}

/**
 * Auth service for BFF (Backend for Frontend) authentication pattern
 * Uses server-side sessions with Auth0 instead of client-side tokens
 */
@Injectable()
export class AuthService implements OnDestroy {
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private document = inject(DOCUMENT);
  private httpRequest = injectRequest();
  private checkAuthInterval: ReturnType<typeof setInterval> | null = null;

  // Auth state - order matters: isAuthenticatedResource and isAuthenticated must be defined first
  readonly isAuthenticatedResource = httpResource<boolean>(
    () => ({
      url: '/api/auth/authenticated',
      method: 'GET',
      headers: getRequestHeaders(this.httpRequest, {
        accept: 'application/json',
      }),
      withCredentials: true,
    }),
    {
      defaultValue: false,
      parse: (value: unknown) => {
        return (value as { authenticated: boolean }).authenticated;
      },
    }
  );

  readonly isAuthenticated = this.isAuthenticatedResource.asReadonly().value;

  readonly userResource = httpResource<AuthUser | null>(
    () => {
      if (this.isAuthenticated()) {
        return {
          url: '/api/auth/user',
          method: 'GET',
          headers: getRequestHeaders(this.httpRequest, {
            accept: 'application/json',
          }),
          withCredentials: true,
          parse: (raw: GenericUserInfo) => {
            return transformUserFromProvider(raw);
          },
        };
      }
      return;
    },
    { defaultValue: null }
  );

  readonly user = this.userResource.asReadonly().value;

  constructor() {
    // Check authentication status on startup
    this.isAuthenticatedResource.reload();

    if (isPlatformBrowser(this.platformId)) {
      // Set up periodic check for authentication status
      this.checkAuthInterval = setInterval(() => {
        this.isAuthenticatedResource.reload();
      }, 5 * 60 * 1000); // Check every 5 minutes
    }

    effect(() => {
      // Automatically fetch user profile when authenticated
      if (this.isAuthenticated()) {
        this.userResource.reload();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.checkAuthInterval) {
      clearInterval(this.checkAuthInterval);
    }
  }

  /**
   * Login the user by redirecting to the login endpoint
   * @param targetUrl Optional URL to redirect to after login
   */
  login(targetUrl?: string): void {
    if (isPlatformBrowser(this.platformId)) {
      const redirectUri = targetUrl || this.router.url;
      const url = this.document.location.origin + redirectUri;
      this.document.location.href = `/api/auth/login?redirect_uri=${encodeURIComponent(
        url
      )}`;
    }
  }

  /**
   * Logout the user by redirecting to the logout endpoint
   */
  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const logoutUrl = `/api/auth/logout?redirect_uri=${encodeURIComponent(
          '/'
        )}`;
        // Clear local state before redirect
        this.userResource.set(null);
        if (this.checkAuthInterval) {
          clearInterval(this.checkAuthInterval);
        }
        this.document.location.href = logoutUrl;
      } catch (error) {
        console.error('Logout failed:', error);
        // Implement fallback logout mechanism
      }
    }
  }

  /**
   * Check if user has the required roles
   * @param roles Array of roles to check
   */
  hasRoles(roles: string[]): boolean {
    const user = this.userResource.value();
    if (!user || !user.roles) return false;

    return roles.some((role) => user.roles?.lastIndexOf(role) !== -1);
  }
}
