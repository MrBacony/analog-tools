import { TRPCErrorData } from "../types/trpc";
import { proxyClient } from "./createProxy";
import { createDefaultConfirmation } from './createDefaultConfirmation';

/**
 * Wraps a TRPC client with error handling for auth errors
 * @param client The original TRPC client
 * @param errorHandler A function to handle errors. if returns true, the error is handled and catched
 * @returns A wrapped TRPC client with error handling
 */
export function wrapTrpcClientWithErrorHandling<T>(
  client: Record<string, unknown>,
  errorHandler?: (errorData: TRPCErrorData | undefined) => boolean,
): T {
  // Create a proxy that intercepts all client calls
  return proxyClient(
    client,
    errorHandler ?? createDefaultConfirmation,
  ) as unknown as T;
}
