import { defineEventHandler } from 'h3';
import { getSession } from '@analog-tools/session';

export default defineEventHandler(async (event) => {
  const session = await getSession(event);
  return {
    user: session?.auth?.userInfo ?? null,
    isAuthenticated: session?.auth?.isAuthenticated ?? false,
  };
});
