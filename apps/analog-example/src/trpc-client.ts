import { AppRouter } from './server/trpc/routers';
import { createTrpcClient } from '@analogjs/trpc';
import { inject } from '@angular/core';
import { SuperJSON } from 'superjson';
import { createTrpcClientWithAuth } from '@analog-tools/auth/angular';
import { injectRequest } from '@analogjs/router/tokens';

export const { provideTrpcClient, TrpcClient, TrpcHeaders } =
  createTrpcClient<AppRouter>({
    url: '/api/trpc',
    options: {
      transformer: SuperJSON,
    },
  });

export function injectTrpcClient() {
  return createTrpcClientWithAuth(inject(TrpcClient), injectRequest(), TrpcHeaders);
}
