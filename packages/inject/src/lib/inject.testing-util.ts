import { InjectionServiceClass } from './inject.types';
import { getServiceRegistry } from './service-registry';

export function registerMockService<T>(
  token: InjectionServiceClass<T>,
  customObject: Partial<T>
): void {
  getServiceRegistry().registerCustomServiceInstance(token, customObject);
}

export function resetAllInjections(): void {
  getServiceRegistry().destroy();
}
