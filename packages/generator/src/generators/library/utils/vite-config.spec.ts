import { updateViteConfig } from './vite-config';

describe('updateViteConfig', () => {
  it('does not duplicate an existing additionalPagesDirs path', () => {
    const content = `import { defineConfig } from 'vite';
import analog from '@analogjs/platform';

export default defineConfig(() => ({
  plugins: [
    analog({
      additionalPagesDirs: ['/libs/test-lib/src/pages'],
    }),
  ],
}));`;

    const updated = updateViteConfig(content, 'libs/test-lib/src', {
      addPages: true,
      addApi: false,
    });

    const matches = updated.match(/\/libs\/test-lib\/src\/pages/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('does not duplicate an existing additionalAPIDirs path', () => {
    const content = `import { defineConfig } from 'vite';
import analog from '@analogjs/platform';

export default defineConfig(() => ({
  plugins: [
    analog({
      additionalAPIDirs: ['/libs/test-lib/src/backend/api'],
    }),
  ],
}));`;

    const updated = updateViteConfig(content, 'libs/test-lib/src', {
      addPages: false,
      addApi: true,
    });

    const matches = updated.match(/\/libs\/test-lib\/src\/backend\/api/g) ?? [];
    expect(matches).toHaveLength(1);
  });
});