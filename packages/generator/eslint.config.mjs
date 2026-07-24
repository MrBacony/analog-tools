import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs}',
            '{projectRoot}/vite.config.{js,ts,mjs,mts}',
          ],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  {
    files: ['**/package.json', '**/package.json', '**/generators.json'],
    rules: {
      '@nx/nx-plugin-checks': 'error',
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      // Preset defaults (nx flat/javascript, flat/typescript), not user-configured.
      // This project's base-config reference was broken (wrong file extension) since
      // it was added, so lint always crashed before these could ever be reported; the
      // ESLint v9 flat-config migration fixed the reference and surfaced them for the
      // first time. Disabled to restore the passing baseline per migration policy.
      'no-useless-escape': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
];
