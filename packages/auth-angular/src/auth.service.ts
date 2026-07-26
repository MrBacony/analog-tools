import {
  DOCUMENT,
  computed,
  EffectRef,
  effect,
  inject,
  Injectable,
  Injector,
  makeStateKey,
  OnDestroy,
  PLATFORM_ID,
  runInInjectionContext,
  signal,
  TransferState,
} from '@angular/core';
import { Router } from '@angular/router';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
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

type AuthTransferSnapshot = {
  authenticated: boolean;
  user: AuthUser | null;
};

export const AUTH_TRANSFER_STATE_KEY = makeStateKey<AuthTransferSnapshot | null>(
  'analog-tools.auth.snapshot'
);

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
  private transferState = inject(TransferState);
  private checkAuthInterval: ReturnType<typeof setInterval> | null = null;
  private userReloadEffect: EffectRef | null = null;
  private userReloadTimeout: ReturnType<typeof setTimeout> | null = null;
  private userReloadAttempts = 0;
  private hasRevalidatedBrowserAuth = false;
  private providedServerRequest = signal<ReturnType<typeof injectRequest>>(null);
  private transferredSnapshot = this.consumeTransferredSnapshot();

  private isSettledResourceStatus(status: string): boolean {
    return status === 'resolved' || status === 'local' || status === 'error';
  }

  private consumeTransferredSnapshot(): AuthTransferSnapshot | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    if (!this.transferState.hasKey(AUTH_TRANSFER_STATE_KEY)) {
      return null;
    }

    const snapshot = this.transferState.get(AUTH_TRANSFER_STATE_KEY, null);
    this.transferState.remove(AUTH_TRANSFER_STATE_KEY);

    return snapshot;
  }

  setServerRequest(serverRequest: ReturnType<typeof injectRequest>): void {
    if (serverRequest) {
      this.providedServerRequest.set(serverRequest);
    }
  }

  private resolveRequestHeaders(
    originalHeaderValues?: { [key: string]: string | null | undefined }
  ) {
    const providedServerRequest = this.providedServerRequest();

    if (providedServerRequest) {
      return getRequestHeaders(providedServerRequest, originalHeaderValues);
    }

    return runInInjectionContext(this.injector, () => {
      return getRequestHeaders(injectRequest(), originalHeaderValues);
    });
  }

  // Auth state - order matters: isAuthenticatedResource and isAuthenticated must be defined first
  readonly isAuthenticatedResource = httpResource<boolean>(
    () => {
      return {
        url: '/api/auth/authenticated',
        method: 'GET',
        headers: this.resolveRequestHeaders({
          accept: 'application/json',
        }),
        withCredentials: true,
      };
    },
    {
      defaultValue: this.transferredSnapshot?.authenticated ?? false,
      parse: (value: unknown) => {
        return (value as { authenticated: boolean }).authenticated;
      },
    }
  );

  readonly isAuthenticated = this.isAuthenticatedResource.asReadonly().value;

  readonly isAuthenticationResolved = computed(() => {
    const status = this.isAuthenticatedResource.status();

    return this.isSettledResourceStatus(status);
  });

  readonly isAuthenticationLoading = computed(() => {
    const status = this.isAuthenticatedResource.status();

    return !this.isSettledResourceStatus(status);
  });

  readonly userResource = httpResource<AuthUser | null>(
    () => {
      if (!this.isAuthenticated()) {
        return undefined;
      }
      return {
        url: '/api/auth/user',
        method: 'GET',
        headers: this.resolveRequestHeaders({
          accept: 'application/json',
        }),
        withCredentials: true,
      };
    },
    {
      defaultValue: this.transferredSnapshot?.user ?? null,
      parse: (raw: unknown) => {
        return transformUserFromProvider(raw as GenericUserInfo);
      },
    }
  );

  readonly user = this.userResource.asReadonly().value;

  constructor() {
    if (isPlatformServer(this.platformId)) {
      effect(
        () => {
          if (!this.isAuthenticationResolved()) {
            return;
          }

          if (
            this.isAuthenticated() &&
            !this.isSettledResourceStatus(this.userResource.status())
          ) {
            return;
          }

          this.transferState.set(AUTH_TRANSFER_STATE_KEY, {
            authenticated: this.isAuthenticated(),
            user: this.userResource.value(),
          });
        },
        { injector: this.injector }
      );
    }

    if (isPlatformBrowser(this.platformId)) {
      queueMicrotask(() => {
        if (
          !this.hasRevalidatedBrowserAuth &&
          this.isAuthenticationResolved() &&
          !this.isAuthenticated()
        ) {
          this.hasRevalidatedBrowserAuth = true;
          this.isAuthenticatedResource.reload();
        }
      });

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
            this.isSettledResourceStatus(status)
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
      this.document.location.href = `/api/auth/login?redirect_uri=${encodeURIComponent(
        redirectUri
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
