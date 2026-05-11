import { Component, effect, inject } from '@angular/core';
import { AuthService } from '@analog-tools/auth/angular';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  imports: [JsonPipe],
  template: `
    <div class="dashboard">
      <h1>Dashboard {{ authService.isAuthenticated() ? 'Authenticated' : 'Not Authenticated' }}</h1>
      @if (authService.isAuthenticationLoading()) {
        <p>Loading authentication state...</p>
      } @else if (authService.isAuthenticated()) {
        <p data-testid="welcome-message">Welcome, {{ authService.user()?.fullName || authService.user()?.username || 'User' }}!</p>
        <h2>User Info</h2>
        <pre data-testid="user-info">{{ authService.user() | json }}</pre>
        <button (click)="authService.logout()">Logout</button>
      } @else {
        <p>You are not authenticated.</p>
      }
    </div>

    <a href="/">Go to home</a>
  `,
})
export default class DashboardPageComponent {
  readonly authService = inject(AuthService);
  private loginRedirectTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect((onCleanup) => {
      console.log('Auth state changed: ', this.authService.isAuthenticated());
      this.clearLoginRedirectTimeout();

      if (
        !this.authService.isAuthenticationLoading() &&
        !this.authService.isAuthenticated()
      ) {
        this.loginRedirectTimeout = setTimeout(() => {
          this.loginRedirectTimeout = undefined;
          this.authService.login();
        }, 3000);
      }

      onCleanup(() => this.clearLoginRedirectTimeout());
    });
  }

  private clearLoginRedirectTimeout() {
    if (this.loginRedirectTimeout !== undefined) {
      clearTimeout(this.loginRedirectTimeout);
      this.loginRedirectTimeout = undefined;
    }
  }
}
