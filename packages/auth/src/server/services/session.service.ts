import { createError, H3Event } from 'h3';
import {
  useSession,
  getSession,
  updateSession,
  destroySession,
  createMemoryStore,
  createRedisStore,
} from '@analog-tools/session';
import type { Storage } from 'unstorage';
import { AuthSessionData, SessionWithSave } from '../types/auth-session.types';
import { LoggerService } from '@analog-tools/logger';
import { inject } from '@analog-tools/inject';
import { type SessionStorageConfig } from '../types/auth.types';

export class SessionService {
  static readonly INJECTABLE = true;
  private readonly storageConfig: SessionStorageConfig;
  private store!: Storage<AuthSessionData>;
  private logger: LoggerService;

  constructor(config: SessionStorageConfig) {
    this.storageConfig = config;

    this.logger = inject(LoggerService).forContext('SessionService');
  }

  async initSession(event: H3Event): Promise<void> {
    // Check if session is already initialized
    const existingSession = getSession<AuthSessionData>(event);
    
    if (!existingSession) {
      this.logger.info('Creating new session');
      
      // Create appropriate store based on config
      if (!this.store) {
        if (this.storageConfig.type === 'redis') {
          // Convert Redis config to match createRedisStore expectations
          const redisConfig = { ...this.storageConfig.config };
          
          // Handle different Redis configuration types (URL vs host/port)
          if ('url' in redisConfig) {
            // URL-based configuration
            this.store = createRedisStore<AuthSessionData>(redisConfig);
          } else if ('host' in redisConfig) {
            // Host/port-based configuration - ensure port is number
            const hostPortConfig = {
              ...redisConfig,
              port: typeof redisConfig.port === 'string' 
                ? parseInt(redisConfig.port, 10) 
                : redisConfig.port
            };
            this.store = createRedisStore<AuthSessionData>(hostPortConfig);
          } else {
            throw new Error('Invalid Redis configuration: must provide either url or host/port');
          }
        } else {
          this.store = createMemoryStore<AuthSessionData>();
        }
      }
      
      await useSession<AuthSessionData>(event, {
        store: this.store,
        secret:
          this.storageConfig.config.sessionSecret || 'change-me-in-production',
        name: 'auth.session',
        maxAge: 60 * 60 * 24, // 24 hours
        cookie: {
          httpOnly: true,
          secure: process.env['NODE_ENV'] === 'production',
          sameSite: process.env['NODE_ENV'] === 'production' ? 'lax' : 'strict',
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
        'Session already exists, skipping initialization'
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
      const sessionData = await this.store.getItem(sessionId);

      if (!sessionData) {
        return null;
      }

      // Create a session object with basic needed functionality
      return {
        id: sessionId,
        data: sessionData as AuthSessionData,
        save: async () => {
          await this.store.setItem(sessionId, sessionData);
        },
      };
    } catch (error) {
      this.logger.error(`Error retrieving session`, error, { sessionId });
      return null;
    }
  }

  /**
   * Get all active sessions from storage
   * @returns Array of session objects
   */
  async getActiveSessions(): Promise<SessionWithSave[]> {
    try {
      // Get all session keys from storage
      const sessionKeys = await this.store.getKeys();

      // Map keys to session objects
      const sessions = await Promise.all(
        sessionKeys.map(async (key) => {
          const sessionData = await this.store.getItem(key);
          if (!sessionData) return null;

          // Extract session ID from the key (remove prefix if exists)
          const sessionId = this.storageConfig.config.prefix 
            ? key.replace(`${this.storageConfig.config.prefix}:`, '')
            : key;

          return {
            id: sessionId,
            data: sessionData,
            save: async () => {
              await this.store.setItem(key, sessionData);
            },
          };
        })
      );

      // Filter out null values
      return sessions.filter((session): session is SessionWithSave => session !== null);
    } catch (error) {
      this.logger.error('Error retrieving active sessions', error);
      return [];
    }
  }

  async destroyAuthSession(event: H3Event): Promise<void> {
    try {
      await this.initSession(event);
      
      // Get current session data to check if auth exists
      const sessionData = getSession<AuthSessionData>(event);
      
      if (sessionData?.auth) {
        // Clear auth data first
        await updateSession<AuthSessionData>(event, (data) => {
          const updatedData = { ...data };
          delete updatedData.auth;
          return updatedData;
        });
      }

      // Destroy the session using new API
      await destroySession(event);
      
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
    
    const sessionData = getSession<AuthSessionData>(event);
    
    this.logger.debug(
      `Retrieved session data`,
      sessionData
    );

    return (sessionData?.[key] as T) || null;
  }

  async setSessionData<T>(
    event: H3Event,
    key: keyof AuthSessionData,
    value: T
  ): Promise<void> {
    await this.initSession(event);
    
    await updateSession<AuthSessionData>(event, (data) => ({
      ...data,
      [key]: value,
    }));
  }

  async isValidSession(event: H3Event): Promise<boolean> {
    await this.initSession(event);
    const sessionData = getSession<AuthSessionData>(event);
    return !!sessionData;
  }
}
