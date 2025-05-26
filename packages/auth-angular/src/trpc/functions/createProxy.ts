import { Observable, catchError, throwError } from "rxjs";
import { ProcedureMethod, TRPCErrorData } from "../types/trpc";
import { TRPCClientError } from '@trpc/client';
import { AnyRouter } from '@trpc/server';

export function proxyClient<Router extends AnyRouter>(
  client: Record<string, unknown>,
  errorHandler: (errorData: TRPCErrorData | undefined) => boolean,
) {
  return new Proxy(client, {
    get(target, prop) {
      return new Proxy(
        target[prop as keyof typeof target] as Record<string, unknown>,
        {
          get(target, prop) {
            return proxyProcedure<Router>(
              target[prop as keyof typeof target] as Record<string, unknown>,
              errorHandler,
            );
          },
        },
      );
    },
  });
}

function proxyProcedure<Router extends AnyRouter>(
  procedure: Record<string, unknown>,
  errorHandler: (errorData: TRPCErrorData | undefined) => boolean,
) {
  return new Proxy(procedure, {
    get(procedureTarget, procedureProp) {
      const procedureMethod =
        procedureTarget[procedureProp as keyof typeof procedureTarget];

      // Only intercept query and mutate methods
      if (procedureProp !== 'query' && procedureProp !== 'mutate') {
        return procedureMethod;
      }

      // Return a wrapped version of the method that catches errors
      return function (...args: unknown[]) {
        const method = procedureMethod as ProcedureMethod;
        const result = method(...args);

        // If the result is an Observable (for Angular), add error handling
        if (result instanceof Observable) {
          return result.pipe(
            catchError((error) => {
              // Check if it's a TRPC client error with UNAUTHORIZED code
              if (error instanceof TRPCClientError) {
                const trpcError = error as TRPCClientError<Router>;
                const errorData = trpcError.data as TRPCErrorData | undefined;

                if(errorHandler(errorData)) {
                  // Handle the error and prevent it from propagating
                  return new Observable<never>((subscriber) => {
                    subscriber.complete();
                  });
                }
              }

              // Always rethrow the error for other error handlers
              return throwError(() => error);
            }),
          );
        }

        return result;
      };
    },
  });
}