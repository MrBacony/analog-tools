/**
 * Default logger configuration for metadata-based styling
 */

import { ColorEnum, Icon } from './logger.types';

/**
 * Style configuration for semantic style names
 */
export interface StyleConfig {
  color: ColorEnum;
  bold?: boolean;
  underline?: boolean;
}

/**
 * Global style scheme configuration
 */
export interface StyleScheme {
  highlight: StyleConfig;
  accent: StyleConfig;
  attention: StyleConfig;
  success: StyleConfig;
  warning: StyleConfig;
  error: StyleConfig;
  info: StyleConfig;
  debug: StyleConfig;
}

/**
 * Icon scheme configuration
 */
export interface IconScheme {
  success: Icon;
  warning: Icon;
  error: Icon;
  info: Icon;
  debug: Icon;
}

/**
 * Global logger styling configuration
 */
export interface LoggerStyleConfig {
  styles: Partial<StyleScheme>;
  icons: Partial<IconScheme>;
}

/**
 * Default style scheme
 */
export const DEFAULT_STYLE_SCHEME: StyleScheme = {
  highlight: { color: ColorEnum.LemonYellow, bold: true },
  accent: { color: ColorEnum.SkyBlue },
  attention: { color: ColorEnum.RoyalPurple, bold: true },
  success: { color: ColorEnum.ForestGreen },
  warning: { color: ColorEnum.TangerineOrange },
  error: { color: ColorEnum.FireRed },
  info: { color: ColorEnum.OceanBlue },
  debug: { color: ColorEnum.SlateGray },
};

/**
 * Default icon scheme
 */
export const DEFAULT_ICON_SCHEME: IconScheme = {
  success: '✅',
  warning: '⚠️',
  error: '❌',
  info: 'ℹ️',
  debug: '🐞',
};
