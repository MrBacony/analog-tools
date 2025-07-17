// Simplified Session Package - Export the new functional API
// Replaces complex dual API pattern (Session class + functional approach)

// Export types
export * from './types';

// Export core session functions (replaces Session class + SessionHandler + SessionState)
export {
  useSession,
  getSession,
  updateSession,
  destroySession,
  regenerateSession,
} from './session';

// Export storage factory functions (replaces UnstorageSessionStore wrapper + registerStorage)
export {
  createMemoryStore,
  createRedisStore,
} from './storage';

// Export essential crypto functions (replaces 309-line crypto module)
export {
  signCookie,
  unsignCookie,
} from './crypto';

export { type Storage } from 'unstorage';
