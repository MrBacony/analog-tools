import { AnalogAuthConfig } from '@analog-tools/auth';

export const authConfig: AnalogAuthConfig = {
  issuer: process.env['AUTH_ISSUER'] || '',
  clientId: process.env['AUTH_CLIENT_ID'] || '',
  clientSecret: process.env['AUTH_CLIENT_SECRET'] || '',
  audience: process.env['AUTH_AUDIENCE'] || '',
  scope: process.env['AUTH_SCOPE'] || 'openid profile email',
  callbackUri: process.env['AUTH_CALLBACK_URL'] || '',
  // Critical: Define unprotected routes to prevent authentication loops
  unprotectedRoutes: [],
  /*userHandler: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createOrUpdateUser: async (userData: any) => {
            const userService = UserService.getInstance();
            await userService.createOrUpdateUser(userData as RawUserProfile);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mapUserToLocal: (data: any) => {
            return transformUserDBtoUser(data);
        },
    },*/
  sessionStorage: {
    type: 'redis',
    config: {
      url: process.env['REDIS_URL'] || 'redis://localhost:6379',
      sessionSecret: process.env['SESSION_SECRET'] || 'default-dev-secret',
      ttl: 86400, // 24 hours
    },
  },
};
