// Session package - functional API for H3-based applications

// Export types
export * from './types';

// Export core session functions
export {
  useSession,
  getSession,
  updateSession,
  destroySession,
  regenerateSession,
} from './session';

// Export storage factory functions
export {
  createMemoryStore,
  createRedisStore,
  createUnstorageStore,
} from './storage';

// Export crypto functions
export {
  signCookie,
  unsignCookie,
} from './crypto';

export { type Storage } from 'unstorage';

export { type AvailableDrivers, type DriverOptions } from './types';
