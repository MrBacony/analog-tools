/// <reference types='vitest' />
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as path from 'path';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/logger',
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
    ...(process.env['VITEST'] ? [tsconfigPaths()] : []),
  ],
  publicDir: false,
  build: {
    outDir: '../../node_modules/@analog-tools/logger',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: 'src/index.ts',
      name: 'logger',
      fileName: (format) => {
        let prefix = 'js';
        if (format === 'cjs') {
          prefix = 'cjs';
        }

        return `index.${prefix}`;
      },
      formats: ['es' as const, 'cjs' as const],
    },
    rollupOptions: {
      external: ['h3'],
    },
  },
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/packages/logger',
      provider: 'v8' as const,
    },
  },
}));
