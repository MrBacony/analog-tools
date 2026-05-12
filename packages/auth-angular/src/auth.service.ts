import {
  DOCUMENT,
  computed,
  EffectRef,
  effect,
  inject,
  Injectable,
  Injector,
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

const MAX_USER_RELOAD_ATTEMPTS = 3;

/**
 * Auth service for BFF (Backend for Frontend) authentication pattern
 * Uses server-side sessions with Auth0 instead of client-side tokens
 */
@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private document = inject(DOCUMENT);
  private injector = inject(Injector);
  private httpRequest = injectRequest();
  private checkAuthInterval: ReturnType<typeof setInterval> | null = null;
  private userReloadEffect: EffectRef | null = null;
  private userReloadTimeout: ReturnType<typeof setTimeout> | null = null;
  private userReloadAttempts = 0;

  // Auth state - order matters: isAuthenticatedResource and isAuthenticated must be defined first
  readonly isAuthenticatedResource = httpResource<boolean>(
    () => {
      // Skip on SSR – the server has no session cookie so the request
      // always returns 401 and poisons the hydrated resource state.
      if (!isPlatformBrowser(this.platformId)) {
        return undefined;
      }
      return {
        url: '/api/auth/authenticated',
        method: 'GET',
        headers: getRequestHeaders(this.httpRequest, {
          accept: 'application/json',
        }),
        withCredentials: true,
      };
    },
    {
      defaultValue: false,
      parse: (value: unknown) => {
        return (value as { authenticated: boolean }).authenticated;
      },
    }
  );

  readonly isAuthenticated = this.isAuthenticatedResource.asReadonly().value;

  readonly isAuthenticationResolved = computed(() => {
    const status = this.isAuthenticatedResource.status();

    return status === 'resolved' || status === 'local' || status === 'error';
  });

  readonly isAuthenticationLoading = computed(() => {
    const status = this.isAuthenticatedResource.status();

    return status === 'idle' || status === 'loading' || status === 'reloading';
  });

  readonly userResource = httpResource<AuthUser | null>(
    () => {
      if (!isPlatformBrowser(this.platformId) || !this.isAuthenticated()) {
        return undefined;
      }
      return {
        url: '/api/auth/user',
        method: 'GET',
        headers: getRequestHeaders(this.httpRequest, {
          accept: 'application/json',
        }),
        withCredentials: true,
      };
    },
    {
      defaultValue: null,
      parse: (raw: unknown) => {
        return transformUserFromProvider(raw as GenericUserInfo);
      },
    }
  );

  readonly user = this.userResource.asReadonly().value;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.userReloadEffect = effect(
        () => {
          const isAuthenticated = this.isAuthenticated();
          const user = this.userResource.value();
          const status = this.userResource.status();

          if (!isAuthenticated || user !== null) {
            this.clearUserReloadRetry();
            return;
          }

          if (
            this.userReloadAttempts < MAX_USER_RELOAD_ATTEMPTS &&
            (status === 'resolved' || status === 'local' || status === 'error')
          ) {
            this.userReloadAttempts += 1;
            this.userResource.reload();
            this.scheduleUserReloadRetry();
          }
        },
        { injector: this.injector }
      );

      // Set up periodic check for authentication status
      this.checkAuthInterval = setInterval(() => {
        this.isAuthenticatedResource.reload();
      }, 5 * 60 * 1000); // Check every 5 minutes
    }
  }

  ngOnDestroy(): void {
    if (this.checkAuthInterval) {
      clearInterval(this.checkAuthInterval);
    }
    this.clearUserReloadRetry();
    this.userReloadEffect?.destroy();
  }

  private clearUserReloadRetry(): void {
    this.userReloadAttempts = 0;

    if (this.userReloadTimeout) {
      clearTimeout(this.userReloadTimeout);
      this.userReloadTimeout = null;
    }
  }

  private scheduleUserReloadRetry(): void {
    if (
      this.userReloadTimeout ||
      this.userReloadAttempts >= MAX_USER_RELOAD_ATTEMPTS
    ) {
      return;
    }

    this.userReloadTimeout = setTimeout(() => {
      this.userReloadTimeout = null;

      if (this.isAuthenticated() && this.userResource.value() === null) {
        this.userResource.reload();
        this.scheduleUserReloadRetry();
      }
    }, 1000);
  }

  waitForAuthentication(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId) || this.isAuthenticationResolved()) {
      return Promise.resolve(this.isAuthenticated());
    }

    return new Promise<boolean>((resolve) => {
      const watcher = effect(
        () => {
          if (this.isAuthenticationResolved()) {
            resolve(this.isAuthenticated());
            queueMicrotask(() => watcher.destroy());
          }
        },
        { injector: this.injector }
      );
    });
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
