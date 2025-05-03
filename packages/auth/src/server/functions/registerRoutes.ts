import authenticated from '../routes/authenticated';
import callback from '../routes/callback';
import login from '../routes/login';
import logout from '../routes/logout';
import protectedData from '../routes/protected-data';
import refreshTokens from '../routes/refresh-tokens';
import user from '../routes/user';

/**
 * Registers all authentication routes dynamically
 * @returns A record of route paths mapped to their handler functions
 */
export function registerRoutes() {
  return { 
    [authenticated.path]: authenticated.handler,
    [callback.path]: callback.handler,
    [login.path]: login.handler,
    [logout.path]: logout.handler,
    [protectedData.path]: protectedData.handler,
    [refreshTokens.path]: refreshTokens.handler,
    [user.path]: user.handler
  };
}