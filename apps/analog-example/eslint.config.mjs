import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['*.ts'],
    extends: [
      'plugin:@nx/angular',
      'plugin:@angular-eslint/template/process-inline-templates',
    ],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
