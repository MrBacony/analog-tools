import { JsonPipe } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { AuthService, authGuard } from '@analog-tools/auth/angular';
import { RouteMeta } from '@analogjs/router';

export const routeMeta: RouteMeta = {
  title: 'Dashboard',
  canActivate: [authGuard],
};

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

  constructor() {
    effect(() => {
      console.log('Auth state changed: ', this.authService.isAuthenticated());
    });
  }
}
