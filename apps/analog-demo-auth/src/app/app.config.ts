import {
  ApplicationConfig,
  ENVIRONMENT_INITIALIZER,
  provideBrowserGlobalErrorListeners,
  inject,
} from '@angular/core';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { provideFileRouter, requestContextInterceptor } from '@analogjs/router';
import { injectRequest } from '@analogjs/router/tokens';

import {
  AuthService,
  authInterceptor,
  provideAuthClient,
} from '@analog-tools/auth/angular';
export const appConfig: ApplicationConfig = {
  providers: [
    provideAuthClient(),
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue() {
        const authService = inject(AuthService);
        authService.setServerRequest(injectRequest());
      },
    },
    provideBrowserGlobalErrorListeners(),

    provideFileRouter(),
    provideClientHydration(),
    provideHttpClient(
      withFetch(),
      withInterceptors([requestContextInterceptor, authInterceptor]),
    ),
  ],
};
