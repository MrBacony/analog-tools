import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, addProjectConfiguration } from '@nx/devkit';

import { apiRouteGenerator } from './api-route';

describe('api-route generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should create an API route inside a library project', async () => {
    addProjectConfiguration(tree, 'test-lib', {
      root: 'libs/test-lib',
      projectType: 'library',
      targets: {},
    });

    await apiRouteGenerator(tree, {
      project: 'test-lib',
      route: 'v1/hello',
    });

    expect(
      tree.exists('libs/test-lib/src/api/routes/api/v1/hello.ts')
    ).toBe(true);
  });

  it('should create an API route inside an application project', async () => {
    addProjectConfiguration(tree, 'test-app', {
      root: 'apps/test-app',
      projectType: 'application',
      targets: {},
    });

    await apiRouteGenerator(tree, {
      project: 'test-app',
      route: 'v1/greeting',
    });

    expect(
      tree.exists('apps/test-app/src/server/routes/api/v1/greeting.ts')
    ).toBe(true);
  });

  it('should create a method-specific API route when method is provided', async () => {
    addProjectConfiguration(tree, 'test-lib', {
      root: 'libs/test-lib',
      projectType: 'library',
      targets: {},
    });

    await apiRouteGenerator(tree, {
      project: 'test-lib',
      route: 'v1/user',
      method: 'POST',
    });

    expect(
      tree.exists('libs/test-lib/src/api/routes/api/v1/user.post.ts')
    ).toBe(true);
  });

  it('should transform colon parameters to bracket syntax', async () => {
    addProjectConfiguration(tree, 'test-lib', {
      root: 'libs/test-lib',
      projectType: 'library',
      targets: {},
    });

    await apiRouteGenerator(tree, {
      project: 'test-lib',
      route: 'users/:id',
    });

    expect(
      tree.exists('libs/test-lib/src/api/routes/api/users/[id].ts')
    ).toBe(true);
  });

  it('should throw when the route already exists', async () => {
    addProjectConfiguration(tree, 'test-lib', {
      root: 'libs/test-lib',
      projectType: 'library',
      targets: {},
    });

    const existing = 'libs/test-lib/src/api/routes/api/v1/hello.ts';
    tree.write(existing, 'export default {};');

    await expect(
      apiRouteGenerator(tree, {
        project: 'test-lib',
        route: 'v1/hello',
      })
    ).rejects.toThrow(/already exists/);
  });
});
