import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as path from 'path';

export default defineConfig(({ mode }) => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/auth',
  resolve: {
    // Resolve @analog-tools/* to workspace TS source for vitest, so tests
    // don't depend on sibling packages being pre-built. The published
    // production build must resolve via node_modules instead, so the
    // workspace path mappings are switched off there.
    tsconfigPaths: mode !== 'production',
  },
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
      aliasesExclude: [/@analog-tools\/.*/],
    }),
    ...(process.env['VITEST'] ? [tsconfigPaths()] : []),
  ],
  publicDir: false,
  build: {
    outDir: '../../node_modules/@analog-tools/auth',
    emptyOutDir: true,
    reportCompressedSize: true,
    sourcemap: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      // Could also be a dictionary or array of multiple entry points.
      entry: {
        '.': 'src/index.ts',
      },
      name: 'auth',
      fileName: (format, entryName) => {
        let prefix = 'js';
        if (format === 'cjs') {
          prefix = 'cjs';
        }
        if(entryName.startsWith('.')) {
          entryName = entryName.substring(1);
        }
        if(entryName.startsWith('/')) {
          entryName = entryName.substring(1) + '/';

        }
        return `${entryName}index.${prefix}`;
      },
      // Change this to the formats you want to support.
      // Don't forget to update your package.json as well.
      formats: ['es' as const, 'cjs' as const],
    },
    rollupOptions: {
      // External packages that should not be bundled into your library.
      external: [
        'node:buffer',
        'h3',
        '@analog-tools/session',
        '@analogjs/router',
        '@angular/core',
        '@angular/router',
        '@angular/common',
        'rxjs',
        '@trpc/server',
        '@trpc/client',
        /^@angular\/.*/, 'rxjs/operators',
        '@analog-tools/session',
        'path'
      ],
    },
  },
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/packages/auth',
      provider: 'v8' as const,
    },
  },
}));
