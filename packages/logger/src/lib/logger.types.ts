/**
 * Configuration options for the LoggerService
 */
export interface LoggerConfig {
  /**
   * The log level to use (trace, debug, info, warn, error, fatal, silent)
   * @default 'info'
   */
  level?: string;

  /**
   * The name of the logger to use in logs
   * @default 'analog-tools'
   */
  name?: string;

  /**
   * The contexts you don't want to log
   */
  disabledContexts?: string[];

  /**
   * Whether to use colors in the console output
   * @default true
   */
  useColors?: boolean;
}
