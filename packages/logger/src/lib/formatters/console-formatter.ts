import { ILogFormatter, LogEntry } from './formatter.interface';
import { LoggerStyleEngine } from '../logger-style-engine';

/**
 * Console formatter - maintains existing behavior with ANSI colors
 */
export class ConsoleFormatter implements ILogFormatter {
  constructor(private styleEngine: LoggerStyleEngine) {}

  format(entry: LogEntry): string {
    if (entry.styling) {
      return this.styleEngine.formatMessageWithMetadata(
        entry.level,
        entry.message,
        entry.logger,
        entry.styling,
        entry.context
      );
    }

    return this.styleEngine.formatMessage(
      entry.level,
      entry.message,
      entry.logger,
      entry.context
    );
  }
}
