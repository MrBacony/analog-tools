/**
 * Auth session data interface for strongly-typed session operations
 */
export interface AuthSessionData {
  /** Authentication data */
  auth?: {
    /** Whether the user is authenticated */
    isAuthenticated: boolean;
    /** OAuth access token */
    accessToken?: string;
    /** OAuth ID token */
    idToken?: string;
    /** OAuth refresh token */
    refreshToken?: string;
    /** Timestamp when the token expires */
    expiresAt?: number;
    /** User info from OAuth provider */
    userInfo?: Record<string, unknown>;
  };
  /** User data from the database */
  user?: Record<string, unknown> | null;
  /** State parameter for CSRF protection */
  state?: string;
  /** Redirect URL after authentication */
  redirectUrl?: string;
  /** Any additional session data */
  [key: string]: unknown;
}

export interface SessionWithSave {
  /** Session ID */
  id: string;
  /** Session data */
  data: AuthSessionData;
  /** Save session data */
  save: () => Promise<void>;
}

/**
 * Session handler interface for working with session operations
 */
export interface SessionWithHandler extends SessionWithSave {
  /** Update session data immutably */
  update: (updater: (data: AuthSessionData) => AuthSessionData) => void;
}