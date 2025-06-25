import { createError, H3Event } from 'h3';
import {
  registerStorage,
  UnstorageSessionStore,
  useSession,
} from '@analog-tools/session';
import { AuthSessionData, SessionWithSave } from '../types/auth-session.types';
import { LoggerService } from '@analog-tools/logger';
import { inject } from '@analog-tools/inject';
import { type SessionStorageConfig } from '../types/auth.types';

export class SessionService {
  static readonly INJECTABLE = true;
  private readonly storageConfig: SessionStorageConfig;
  private store!: UnstorageSessionStore<AuthSessionData>;
  private logger: LoggerService;

  constructor(config: SessionStorageConfig) {
    this.storageConfig = config;

    this.logger = inject(LoggerService).forContext('SessionService');
  }

  async initSession(event: H3Event): Promise<void> {
    if (!event.context['sessionHandler']) {
      this.logger.info('Creating new session handler');
      this.store = registerStorage(
        this.storageConfig.type,
        this.storageConfig.config
      );
      await useSession<AuthSessionData>(event, {
        store: this.store,
        secret:
          this.storageConfig.config.sessionSecret || 'change-me-in-production',
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
    } else {
      this.logger.debug(
        'Session handler already exists, skipping initialization'
      );
    }
  }

  /**
   * Get a session by session ID
   * @param sessionId The session ID
   * @returns The session object or null if not found
   */
  async getSession(sessionId: string): Promise<SessionWithSave | null> {
    try {
      const sessionData = await this.store.get(sessionId);
      if (!sessionData) {
        return null;
      }

      // Create a mock session object with basic needed functionality
      return {
        id: sessionId,
        data: sessionData,
        save: async () => {
          await this.store.set(sessionId, sessionData);
        },
      };
    } catch (error) {
      this.logger.error(`Error retrieving session`, error, { sessionId });
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
      const sessionKeys = await this.store.all();

      // Map keys to session objects
      return Promise.all(
        Object.keys(sessionKeys).map(async (key) => {
          // Extract session ID from the key (remove prefix)
          const sessionId = key.replace(
            `${this.storageConfig.config.prefix}:`,
            ''
          );
          const sessionData = sessionKeys[key] as AuthSessionData;

          return {
            id: sessionId,
            data: sessionData,
            save: async () => {
              await this.store.set(sessionId, sessionData);
            },
          };
        })
      );
    } catch (error) {
      this.logger.error('Error retrieving active sessions', error);
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
      this.logger.error('Session destruction failed', error);
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
