/**
 * Storage factory functions for session package
 */
import { createStorage, builtinDrivers } from 'unstorage';
import type { Storage } from 'unstorage';
import type { DriverOptions, SessionData } from './types';


export async function createUnstorageStore<T extends SessionData = SessionData>(options: DriverOptions): Promise<Storage<T>> {
  // async import of the driver based on the name
  const driver = await import(/* @vite-ignore */`${builtinDrivers[options.type]}`);
  if(options.type === 'memory') {
    return createStorage({
      driver: driver.default(),
    });
  }
  
  return createStorage({
    driver: driver.default(options.options),
  });
}
