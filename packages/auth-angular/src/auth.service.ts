import {
  computed,
  effect,
  inject,
  Injectable,
  OnDestroy,
  PLATFORM_ID,
} from '@angular/core';
import { Router } from '@angular/router';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpClient, httpResource } from '@angular/common/http';
import {
  GenericUserInfo,
  transformUserFromProvider,
} from './functions/user-transformer';

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
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private document = inject(DOCUMENT);
  private checkAuthInterval: ReturnType<typeof setInterval> | null = null;

  // Auth state
  readonly user = httpResource<AuthUser | null>(
    () => ({
      url: '/api/auth/user',
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
      withCredentials: true,
      parse: (raw: GenericUserInfo) => {
        return transformUserFromProvider(raw);
      },
    }),
    { defaultValue: null }
  );

  readonly isAuthenticated = httpResource<boolean>(
    () => ({
      url: '/api/auth/authenticated',
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
      withCredentials: true,
      parse: (response: { authenticated: boolean }) => response.authenticated,
    }),
    { defaultValue: false }
  );
  readonly isLoading = computed<boolean>(() => {
    return this.isAuthenticated.isLoading() || this.user.isLoading();
  });

  constructor() {
    // Check authentication status on startup
    if (isPlatformBrowser(this.platformId)) {
      this.isAuthenticated.reload();

      // Set up periodic check for authentication status
      this.checkAuthInterval = setInterval(() => {
        this.isAuthenticated.reload();
      }, 5 * 60 * 1000); // Check every 5 minutes
    }

    effect(() => {
      // Automatically fetch user profile when authenticated
      if (this.isAuthenticated.value()) {
        this.user.reload();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.checkAuthInterval) {
      clearInterval(this.checkAuthInterval);
    }
  }

  /**
   * Fetch the user profile from the backend
   */
  private async fetchUserProfile(): Promise<void> {
    try {
      this.user.reload();
    } catch (error) {
      console.error('Error fetching user profile:', error);
      this.user.set(null);
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
        this.user.set(null);
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
    const user = this.user.value();
    if (!user || !user.roles) return false;

    return roles.some((role) => user.roles?.lastIndexOf(role) !== -1);
  }
}
