import { AppRouter } from './server/trpc/routers';
import { createTrpcClient } from '@analogjs/trpc';
import { inject } from '@angular/core';
import { SuperJSON } from 'superjson';
import { injectRequest } from '@analogjs/router/tokens';


export const { provideTrpcClient, TrpcClient, TrpcHeaders } =
  createTrpcClient<AppRouter>({
    url: '/api/trpc',
    options: {
      transformer: SuperJSON,
    },
  });

export function injectTrpcClient() {
  const request = injectRequest();

  const trpcClient = inject(TrpcClient);

  TrpcHeaders.update((headers) => ({
    ...headers,
    fetch: "true",
    cookie: request?.headers.cookie,
  }));

  return trpcClient;
}
