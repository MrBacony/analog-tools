import { createError, H3Event } from 'h3';
import { RedisSessionStore, useSession } from '@analog-tools/session';
import { AuthSessionData, SessionWithSave } from '../types/auth-session.types';

const redisConfig = {
  url: process.env['REDIS_URL'],
  prefix: 'auth-session',
  ttl: 60 * 60 * 24, // 24 hours
};

// Session configuration
const SESSION_SECRET =
  process.env['SESSION_SECRET'] || 'change-me-in-production';
const redisStore = new RedisSessionStore<AuthSessionData>(redisConfig);

export class SessionService {
  static readonly INJECTABLE = true;

  async initSession(event: H3Event): Promise<void> {
    if (!event.context['sessionHandler']) {
      await useSession<AuthSessionData>(event, {
        store: redisStore,
        secret: SESSION_SECRET,
        name: 'auth.session',
        cookie: {
          httpOnly: true,
          secure: process.env['NODE_ENV'] === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24, // 24 hours
        },
        // Initialize default session structure with auth property
        generate: () => ({
          auth: {
            isAuthenticated: false,
          },
        }),
      });
    }
  }

  /**
   * Get a session by session ID
   * @param sessionId The session ID
   * @returns The session object or null if not found
   */
  async getSession(sessionId: string): Promise<SessionWithSave | null> {
    try {
      const sessionData = await redisStore.get(sessionId);
      if (!sessionData) {
        return null;
      }

      // Create a mock session object with basic needed functionality
      return {
        id: sessionId,
        data: sessionData,
        async save() {
          await redisStore.set(sessionId, sessionData);
        },
      };
    } catch (error) {
      console.error(`Error retrieving session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Get all active sessions from Redis
   * @returns Array of session objects
   */
  async getActiveSessions(): Promise<SessionWithSave[]> {
    try {
      // Get all session keys from Redis with the configured prefix
      const sessionKeys = await redisStore.getAll();

      // Map keys to session objects
      return Promise.all(
        Object.keys(sessionKeys).map(async (key) => {
          // Extract session ID from the key (remove prefix)
          const sessionId = key.replace(`${redisConfig.prefix}:`, '');
          const sessionData = sessionKeys[key] as AuthSessionData;

          return {
            id: sessionId,
            data: sessionData,
            async save() {
              await redisStore.set(sessionId, sessionData);
            },
          };
        })
      );
    } catch (error) {
      console.error('Error retrieving active sessions:', error);
      return [];
    }
  }

  async destroySession(event: H3Event): Promise<void> {
    try {
      await this.initSession(event);
      // Use the sessionHandler instead of session after our refactoring
      const sessionHandler = event.context['sessionHandler'];

      // Clear auth data if exists
      if (sessionHandler.data?.auth) {
        sessionHandler.update((data: AuthSessionData) => {
          const updatedData = { ...data };
          delete updatedData.auth;
          return updatedData;
        });
      }

      // Destroy the session
      await sessionHandler.destroy();

      // Clear session from context
      delete event.context['sessionHandler'];
      delete event.context['session'];
      delete event.context['sessionId'];
    } catch (error) {
      console.error('Session destruction failed:', error);
      throw createError({
        statusCode: 500,
        message: 'Session handling failed',
      });
    }
  }

  async getSessionData<T>(
    event: H3Event,
    key: keyof AuthSessionData
  ): Promise<T | null> {
    await this.initSession(event);
    return (event.context['sessionHandler'].data[key] as T) || null;
  }

  async setSessionData<T>(
    event: H3Event,
    key: keyof AuthSessionData,
    value: T
  ): Promise<void> {
    await this.initSession(event);
    event.context['sessionHandler'].update((data: AuthSessionData) => ({
      ...data,
      [key]: value,
    }));
    await event.context['sessionHandler'].save();
  }

  async isValidSession(event: H3Event): Promise<boolean> {
    await this.initSession(event);
    return !!event.context['sessionHandler']?.data;
  }
}
