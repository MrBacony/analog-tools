import { 
  ILogFormatter, 
  ConsoleFormatterConfig, 
  JsonFormatterConfig,
  FormatterFunction,
  LogEntry
} from './formatter.interface';
import { ConsoleFormatter } from './console-formatter';
import { JsonFormatter } from './json-formatter';
import { LoggerStyleEngine } from '../logger-style-engine';

/**
 * Custom formatter wrapper to adapt FormatterFunction to ILogFormatter
 */
class CustomFormatterAdapter implements ILogFormatter {
  constructor(private formatterFn: FormatterFunction) {}
  format(entry: LogEntry): string {
    return this.formatterFn(entry);
  }
}

/**
 * Factory for creating formatters
 */
export class FormatterFactory {
  /**
   * Create a console formatter
   */
  static createConsole(config?: ConsoleFormatterConfig): ILogFormatter {
    const styleEngine = new LoggerStyleEngine({ useColors: config?.useColors });
    return new ConsoleFormatter(styleEngine);
  }

  /**
   * Create a JSON formatter
   */
  static createJson(config?: JsonFormatterConfig): ILogFormatter {
    return new JsonFormatter(config);
  }

  /**
   * Create a custom formatter from a function
   */
  static createCustom(formatterFn: FormatterFunction): ILogFormatter {
    return new CustomFormatterAdapter(formatterFn);
  }
}
