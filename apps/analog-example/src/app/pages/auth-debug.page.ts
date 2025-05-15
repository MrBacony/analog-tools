import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, interval, switchMap, startWith } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-auth-debug',
  template: `
    <div class="auth-debug-container p-4 bg-gray-100 rounded-lg">
      <h2 class="text-lg font-bold mb-4">Authentication Debug</h2>

      <div class="mb-4">
        <button
          (click)="checkAuth()"
          class="px-3 py-1 bg-blue-500 text-white rounded mr-2"
        >
          Check Auth
        </button>
      </div>

      @if (debugData(); as data) {
      <div class="mb-4">
        <h3 class="font-semibold">Session Info:</h3>
        <pre
          class="bg-gray-800 text-white p-2 rounded overflow-auto max-h-96"
          >{{ data | json }}</pre
        >
      </div>
      } @if (authStatus(); as status) {
      <div>
        <h3 class="font-semibold">Auth Status:</h3>
        <div class="bg-gray-800 text-white p-2 rounded">
          <div>Authenticated: {{ status.authenticated }}</div>
        </div>
      </div>
      }
    </div>
  `,
  styles: [
    `
      .auth-debug-container {
        max-width: 800px;
        margin: 1rem auto;
      }
      pre {
        white-space: pre-wrap;
      }
    `,
  ],
})
export default class AuthDebugComponent {
  private http = inject(HttpClient);

  // Auto-refresh auth status every 5 seconds
  authStatus = toSignal(
    interval(5000).pipe(
      startWith(0),
      switchMap(() =>
        this.http.get<{ authenticated: boolean }>('/api/auth/authenticated')
      )
    )
  );

  debugData = signal(null);

  checkAuth() {
    this.http
      .get<{ authenticated: boolean }>('/api/auth/authenticated')
      .subscribe((result) => console.log('Auth check result:', result));
  }
}
