import { ILogFormatter, LogEntry, JsonFormatterConfig } from './formatter.interface';
import { LogLevelEnum } from '../logger.types';
import { ErrorSerializer } from '../error-serialization/error-serializer';

/**
 * JSON formatter - outputs structured JSON for log aggregation systems
 */
export class JsonFormatter implements ILogFormatter {
  private prettyPrint: boolean;

  constructor(config?: JsonFormatterConfig) {
    this.prettyPrint = config?.prettyPrint ?? false;
  }

  format(entry: LogEntry): string {
    try {
      const logObj: Record<string, unknown> = {
        timestamp: entry.timestamp.toISOString(),
        level: this.getLevelName(entry.level),
        logger: entry.logger,
        message: entry.message,
      };

      if (entry.context) {
        logObj['context'] = entry.context;
      }

      if (entry.correlationId) {
        logObj['correlationId'] = entry.correlationId;
      }

      if (entry.metadata && Object.keys(entry.metadata).length > 0) {
        logObj['metadata'] = entry.metadata;
      }

      if (entry.error) {
        const serializedError = ErrorSerializer.serialize(entry.error);
        logObj['error'] = serializedError;
      }

      return JSON.stringify(logObj, null, this.prettyPrint ? 2 : 0);
    } catch {
      // Fallback for extreme cases where JSON.stringify fails (rare but possible with non-serializable content)
      return `${entry.level} [${entry.logger}] ${entry.message} (formatting error)`;
    }
  }

  private getLevelName(level: LogLevelEnum): string {
    switch (level) {
      case LogLevelEnum.trace: return 'trace';
      case LogLevelEnum.debug: return 'debug';
      case LogLevelEnum.info: return 'info';
      case LogLevelEnum.warn: return 'warn';
      case LogLevelEnum.error: return 'error';
      case LogLevelEnum.fatal: return 'fatal';
      default: return 'info';
    }
  }
}
