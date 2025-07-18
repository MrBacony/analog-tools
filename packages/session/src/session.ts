import {
  getCookie,
  setCookie,
  type H3Event,
} from 'h3';
import { nanoid } from 'nanoid';
import type { SessionConfig, SessionData, SessionError } from './types';
import { signCookie, unsignCookie } from './crypto';

// Session storage key for H3 event context
const SESSION_CONTEXT_KEY = '__session_data__';
const SESSION_ID_CONTEXT_KEY = '__session_id__';

/**
 * Initialize session middleware for an H3 event
 */
export async function useSession<T extends SessionData = SessionData>(
  event: H3Event,
  config: SessionConfig<T>
): Promise<void> {
  const cookieName = config.name || 'connect.sid';
  const secrets = Array.isArray(config.secret) ? config.secret : [config.secret];
  
  // Store config in context for other functions to access
  event.context['__session_config__'] = config;
  
  try {
    // Get signed session ID from cookie
    const signedSessionId = getCookie(event, cookieName);
    let sessionId: string | null = null;
    
    if (signedSessionId) {
      sessionId = await unsignCookie(signedSessionId, secrets);
    }
    
    let sessionData: T;
    
    if (sessionId) {
      // Try to load existing session
      const existingData = await config.store.getItem(sessionId);
      if (existingData) {
        sessionData = existingData as T;
      } else {
        // Session ID exists but no data - generate new session
        sessionId = nanoid();
        sessionData = config.generate ? config.generate() : ({} as T);
      }
    } else {
      // No session - generate new one
      sessionId = nanoid();
      sessionData = config.generate ? config.generate() : ({} as T);
    }
    
    // Store session data and ID in event context
    event.context[SESSION_CONTEXT_KEY] = sessionData;
    event.context[SESSION_ID_CONTEXT_KEY] = sessionId;
    
     try {
      // Set signed cookie
      const signedId = await signCookie(sessionId, secrets[0]);
      setCookie(event, cookieName, signedId, {
        maxAge: config.maxAge || 86400,
        httpOnly: config.cookie?.httpOnly ?? true,
        secure: config.cookie?.secure ?? false,
        sameSite: config.cookie?.sameSite ?? 'lax',
        domain: config.cookie?.domain,
        path: config.cookie?.path || '/',
      });
    } catch (error) {
      throw createSessionError('COOKIE_ERROR', 'Failed to sign or set session cookie', { error });
    }
    
    try {
      // Save initial session data
      await config.store.setItem(sessionId, sessionData);
    } catch (error) {
      throw createSessionError('STORAGE_ERROR', 'Failed to save session data to store', { error });
    }
  } catch (error) {
    throw createSessionError('CRYPTO_ERROR', 'An unexpected error occurred during session initialization', { error });
  }
}

/**
 * Get current session data from H3 event context
 */
export function getSession<T extends SessionData = SessionData>(
  event: H3Event
): T | null {
  return event.context[SESSION_CONTEXT_KEY] as T || null;
}

/**
 * Update session data immutably
 */
export async function updateSession<T extends SessionData = SessionData>(
  event: H3Event,
  updater: (data: T) => Partial<T>
): Promise<void> {
  const currentData = getSession<T>(event);
  const sessionId = event.context[SESSION_ID_CONTEXT_KEY] as string;
  
  if (!currentData || !sessionId) {
    throw createSessionError('INVALID_SESSION', 'No active session found');
  }
  
  // Apply updates immutably
  const updates = updater(currentData);
  const newData = { ...currentData, ...updates } as T;
  
  // Update context
  event.context[SESSION_CONTEXT_KEY] = newData;
  
  // Get storage config from event context (set during useSession)
  const config = event.context['__session_config__'] as SessionConfig<T>;
  if (config?.store) {
    await config.store.setItem(sessionId, newData);
  }
}

/**
 * Destroy current session
 */
export async function destroySession(event: H3Event): Promise<void> {
  const sessionId = event.context[SESSION_ID_CONTEXT_KEY] as string;
  const config = event.context['__session_config__'] as SessionConfig;
  
  if (!sessionId) {
    return; // No session to destroy
  }
  
  try {
    // Remove from storage
    if (config?.store) {
      await config.store.removeItem(sessionId);
    }
    
    // Clear context
    delete event.context[SESSION_CONTEXT_KEY];
    delete event.context[SESSION_ID_CONTEXT_KEY];
    
    // Clear cookie
    const cookieName = config?.name || 'connect.sid';
    setCookie(event, cookieName, '', {
      maxAge: 0,
      httpOnly: true,
      path: '/',
    });
    
  } catch (error) {
    throw createSessionError('STORAGE_ERROR', 'Failed to destroy session', { error });
  }
}

/**
 * Regenerate session ID while preserving data
 */
export async function regenerateSession<T extends SessionData = SessionData>(
  event: H3Event
): Promise<void> {
  const currentData = getSession<T>(event);
  const oldSessionId = event.context[SESSION_ID_CONTEXT_KEY] as string;
  const config = event.context['__session_config__'] as SessionConfig<T>;
  
  if (!currentData || !oldSessionId || !config) {
    throw createSessionError('INVALID_SESSION', 'No active session to regenerate');
  }
  
  try {
    // Generate new session ID
    const newSessionId = nanoid();
    
    // Update context with new ID
    event.context[SESSION_ID_CONTEXT_KEY] = newSessionId;
    
    // Save data under new ID
    await config.store.setItem(newSessionId, currentData);
    
    // Remove old session data
    await config.store.removeItem(oldSessionId);
    
    // Update cookie with new signed ID
    const secrets = Array.isArray(config.secret) ? config.secret : [config.secret];
    const signedId = await signCookie(newSessionId, secrets[0]);
    const cookieName = config.name || 'connect.sid';
    
    setCookie(event, cookieName, signedId, {
      maxAge: config.maxAge || 86400,
      httpOnly: config.cookie?.httpOnly ?? true,
      secure: config.cookie?.secure ?? false,
      sameSite: config.cookie?.sameSite ?? 'lax',
      domain: config.cookie?.domain,
      path: config.cookie?.path || '/',
    });
    
  } catch (error) {
    throw createSessionError('STORAGE_ERROR', 'Failed to regenerate session', { error });
  }
}

/**
 * Create a standardized session error
 */
function createSessionError(
  code: SessionError['code'],
  message: string,
  details?: Record<string, unknown>
): Error & { code: SessionError['code']; details?: Record<string, unknown> } {
  const error = new Error(message) as Error & { code: SessionError['code']; details?: Record<string, unknown> };
  error.code = code;
  error.details = details;
  return error;
}
