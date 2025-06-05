import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from './context';
import { SuperJSON } from 'superjson';
import { checkAuthentication } from '@analog-tools/auth';

const t = initTRPC.context<Context>().create({
  transformer: SuperJSON,
});

/**
 * Middleware to check if user is authenticated
 */
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!(await checkAuthentication(ctx.event))) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User is not authenticated',
    });
  }

  // Check the session - we'll use a simple check for now
  // The auth middleware will already have checked authentication
  // and returned 401 if not authenticated

  return next({
    ctx: {
      ...ctx,
      // We could add user info here if needed
    },
  });
});

/**
 * Unprotected procedure - can be accessed without authentication
 **/
export const publicProcedure = t.procedure;

/**
 * Protected procedure - requires authentication
 **/
export const protectedProcedure = t.procedure.use(isAuthenticated);

export const router = t.router;
export const middleware = t.middleware;
