export * from './lib/inject.util';
export {
  registerMockService,
  resetAllInjections,
  registerMockServiceScoped,
  resetScopedInjections,
} from './lib/inject.testing-util';
export {
  InjectionContext,
  injectScoped,
  registerServiceScoped,
  registerServiceAsUndefinedScoped,
} from './lib/injection-context';
export type { InjectionServiceClass, InjectOptions } from './lib/inject.types';

// Symbol-based injection (new)
export { SERVICE_TOKEN, Injectable, createServiceToken } from './lib/symbol-registry';
