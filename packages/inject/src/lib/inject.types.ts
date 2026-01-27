export interface InjectOptions {
  /**
   * Whether to throw an error if the service is not found
   * @default true
   */
  required?: boolean;
}

/**
 * Interface for injectable service classes
 * Type parameter args allows strict typing of constructor parameters
 * Supports classes with required, optional, and default parameters
 * 
 * Note: SERVICE_TOKEN is added at runtime by @Injectable() decorator.
 * The type allows any class constructor; token presence is checked at runtime.
 * @example
 * ```typescript
 * @Injectable()
 * class MyService {
 *   constructor(config: Config) {}
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Default args type must accept any constructor signature.
export interface InjectionServiceClass<T, Args extends unknown[] = any[]> {
  new (...args: Args): T;
}
