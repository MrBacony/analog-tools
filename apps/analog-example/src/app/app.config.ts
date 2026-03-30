import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { provideFileRouter, requestContextInterceptor } from '@analogjs/router';

import { provideTrpcClient } from '../trpc-client';

import { authInterceptor, provideAuthClient } from '@analog-tools/auth/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideFileRouter(),
    provideClientHydration(),
    provideAuthClient(),
    provideHttpClient(
      withFetch(),
      withInterceptors([requestContextInterceptor, authInterceptor])
    ),

    provideTrpcClient(),
  ],
};
