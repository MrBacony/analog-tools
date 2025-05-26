import { injectRequest } from '@analogjs/router/tokens';
import { wrapTrpcClientWithErrorHandling } from './index';
import { HTTPHeaders } from '@trpc/client';
import { WritableSignal } from '@angular/core';

export function createTrpcClientWithAuth<T>(trpcClient: T, TrpcHeaders:  WritableSignal<HTTPHeaders>) {
  const request = injectRequest();

  // Add request headers including cookies for auth
  TrpcHeaders.update((headers) => ({
    ...headers,
    fetch: 'true',
    cookie: request?.headers.cookie,
  }));

  // Wrap the client to add error handling
  return wrapTrpcClientWithErrorHandling<typeof trpcClient>(trpcClient as Record<string, unknown>);
}
