export interface InjectOptions {
  /**
   * Whether to throw an error if the service is not found
   * @default true
   */
  required?: boolean;
}

// Make InjectionServiceClass generic over constructor args
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface InjectionServiceClass<T, Args extends any[] = any[]> {
  new (...args: Args): T;
}
