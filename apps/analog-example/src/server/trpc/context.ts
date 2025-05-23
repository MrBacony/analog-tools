import { inferAsyncReturnType } from '@trpc/server';
import type { H3Event } from 'h3';

/**
 * Creates context for an incoming request
 * @link https://trpc.io/docs/context
 */
export const createContext = (event: H3Event) => {
  // Pass the H3 event to tRPC context so we can access session data
  return { event };
};

export type Context = inferAsyncReturnType<typeof createContext>;
