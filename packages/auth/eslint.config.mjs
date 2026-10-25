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
            '{projectRoot}/rollup.config.{js,ts,mjs,mts,cjs,cts}',
            '{projectRoot}/vite.config.{js,ts,mjs,mts}',
          ],
          // The build copies @analog-tools/auth-angular into the published
          // `angular` subpath; these peers serve that code, which this
          // project's sources never import.
          ignoredDependencies: [
            '@analogjs/router',
            '@angular/core',
            '@angular/common',
            '@angular/router',
            '@trpc/client',
            'rxjs',
          ],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
