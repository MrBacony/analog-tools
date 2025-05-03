import {
  computed,
  Inject,
  Injectable,
  OnDestroy,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

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
  private checkAuthInterval: ReturnType<typeof setInterval> | null = null;

  // Auth state
  readonly user = signal<AuthUser | null>(null);
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isLoading = signal<boolean>(true);

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object,
    @Inject(DOCUMENT) private document: Document
  ) {
    // Check authentication status on startup
    if (isPlatformBrowser(this.platformId)) {
      this.checkAuthentication();

      // Set up periodic check for authentication status
      this.checkAuthInterval = setInterval(() => {
        this.checkAuthentication(true);
      }, 5 * 60 * 1000); // Check every 5 minutes
    }
  }

  ngOnDestroy(): void {
    if (this.checkAuthInterval) {
      clearInterval(this.checkAuthInterval);
    }
  }

  /**
   * Check if the user is authenticated by calling the backend
   * @param silent If true, don't update loading state (for background checks)
   */
  async checkAuthentication(silent = false): Promise<boolean> {
    if (!silent) {
      this.isLoading.set(true);
    }

    try {
      const response = await firstValueFrom(
        this.http.get<{ authenticated: boolean }>('/api/auth/authenticated')
      );
      if (response.authenticated) {
        // If authenticated, get user data
        await this.fetchUserProfile();
        return true;
      } else {
        this.user.set(null);
        return false;
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
      this.user.set(null);
      return false;
    } finally {
      if (!silent) {
        this.isLoading.set(false);
      }
    }
  }

  /**
   * Fetch the user profile from the backend
   */
  private async fetchUserProfile(): Promise<void> {
    try {
      const userData = await firstValueFrom(
        this.http.get<AuthUser>('/api/auth/user')
      );

      console.log('USER LOADED');

      this.user.set(userData);
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
        this.isLoading.set(false);
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
    const user = this.user();
    if (!user || !user.roles) return false;

    return roles.some((role) => user.roles?.includes(role));
  }
}
