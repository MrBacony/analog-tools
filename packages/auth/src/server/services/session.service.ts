import { createError, H3Event } from 'h3';
import {
  useSession,
  getSession,
  updateSession,
  destroySession,
  createUnstorageStore,
} from '@analog-tools/session';
import type { Storage } from 'unstorage';
import { AuthSessionData, SessionWithSave, SessionWithHandler } from '../types/auth-session.types';
import { LoggerService } from '@analog-tools/logger';
import { inject, Injectable } from '@analog-tools/inject';
import { type SessionStorageConfig } from '../types/auth.types';

@Injectable()
export class SessionService {
  private readonly storageConfig: SessionStorageConfig;
  private readonly sessionSecret: string | string[];
  private store!: Storage<AuthSessionData>;
  private logger: LoggerService;

  constructor(config: SessionStorageConfig) {
    this.storageConfig = config;

    this.logger = inject(LoggerService).forContext('SessionService');
    this.sessionSecret = this.resolveSessionSecret();
  }

  /**
   * Resolve and validate the session signing secret. A missing secret is a
   * fatal misconfiguration: the library used to silently fall back to a shared,
   * source-visible default, which let anyone forge session cookies. A non-empty
   * array of secrets is accepted to support key rotation (first entry signs,
   * the rest still verify).
   */
  private resolveSessionSecret(): string | string[] {
    const secret = this.storageConfig.sessionSecret;
    const secrets = Array.isArray(secret) ? secret : [secret];
    const allValid =
      secrets.length > 0 &&
      secrets.every((s) => typeof s === 'string' && s.trim().length > 0);
    if (!allValid) {
      throw new Error(
        'sessionStorage.sessionSecret is required. Provide a strong, unique ' +
          'value or a non-empty array of values (e.g. from a SESSION_SECRET ' +
          'environment variable) — the library no longer falls back to a ' +
          'shared default secret.'
      );
    }
    if ((secrets as string[]).some((s) => s.length < 32)) {
      this.logger.warn(
        'sessionStorage.sessionSecret is shorter than 32 characters; use a ' +
          'longer, high-entropy value for HMAC-SHA256 cookie signing.'
      );
    }
    return secret as string | string[];
  }

  async initSession(event: H3Event): Promise<void> {
    // Check if session is already initialized
    const existingSession = getSession<AuthSessionData>(event);
    
    if (!existingSession) {
      this.logger.debug('Initializing request session context');
      
      // Create appropriate store based on config
      if (!this.store) {
        this.store = await createUnstorageStore<AuthSessionData>(this.storageConfig.driver);
      }
      
      await useSession<AuthSessionData>(event, {
        store: this.store,
        secret: this.sessionSecret,
        name: this.storageConfig.cookieName || 'auth.session',
        maxAge: 60 * 60 * 24, // 24 hours
        cookie: {
          httpOnly: true,
          secure: process.env['NODE_ENV'] === 'production',
          sameSite: 'lax', // Always use 'lax' to allow OAuth redirects
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
   * @returns Array of session objects with update capability
   */
  async getActiveSessions(): Promise<SessionWithHandler[]> {
    try {
      // Get all session keys from storage
      const sessionKeys = await this.store.getKeys();

      // Map keys to session objects
      const sessions = await Promise.all(
        sessionKeys.map(async (key) => {
          const sessionData = await this.store.getItem(key);
          if (!sessionData) return null;

          // Extract session ID from the key (remove prefix if exists)
          const sessionId = this.storageConfig.prefix && key.startsWith(`${this.storageConfig.prefix}:`)
            ? key.substring(`${this.storageConfig.prefix}:`.length)
            : key;

          return {
            id: sessionId,
            data: sessionData,
            update: (updater: (data: AuthSessionData) => AuthSessionData) => {
              // Apply the updater function to get new data
              const updatedData = updater(sessionData as AuthSessionData);
              // Update the local data reference
              Object.assign(sessionData, updatedData);
            },
            save: async () => {
              await this.store.setItem(key, sessionData);
            },
            refetch: async () => {
              return (await this.store.getItem(key)) as AuthSessionData | null;
            },
          };
        })
      );

      // Filter out null values
      return sessions.filter((session): session is SessionWithHandler => session !== null);
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
