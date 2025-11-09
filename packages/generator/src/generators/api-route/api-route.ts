import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import * as path from 'path';
import { ApiRouteGeneratorSchema } from './schema';

const SUPPORTED_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
];

function normalizeRoute(route: string): string {
  const trimmed = route
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.ts$/i, '');

  if (!trimmed) {
    throw new Error('Route must not be empty.');
  }

  const normalizedSegments = trimmed.split('/').map(segment => {
    if (!segment || segment === '.' || segment === '..') {
      throw new Error('Route contains invalid segments.');
    }

    if (segment.startsWith(':')) {
      const paramName = segment.slice(1);
      if (!paramName) {
        throw new Error('Dynamic segment cannot be empty.');
      }
      return `[${paramName}]`;
    }

    return segment;
  });

  return normalizedSegments.join('/');
}

export async function apiRouteGenerator(
  tree: Tree,
  options: ApiRouteGeneratorSchema
) {
  if (!options.route) {
    throw new Error('Option "route" is required.');
  }

  const projectConfig = readProjectConfiguration(tree, options.project);
  const projectRoot = projectConfig.root;

  if (
    projectConfig.projectType !== 'application' &&
    projectConfig.projectType !== 'library'
  ) {
    throw new Error(
      `Project "${options.project}" must be an application or library. Found "${projectConfig.projectType ?? 'unknown'}".`
    );
  }

  const method = options.method ? options.method.toLowerCase() : undefined;
  if (method && !SUPPORTED_METHODS.includes(method)) {
    throw new Error(
      `Unsupported method "${options.method}". Supported methods: ${SUPPORTED_METHODS.join(', ')}.`
    );
  }

  const baseDir = projectConfig.projectType === 'application'
    ? joinPathFragments(projectRoot, 'src/server/routes/api')
    : joinPathFragments(projectRoot, 'src/api/routes/api');

  const normalizedRoute = normalizeRoute(options.route);
  const routeDir = path.posix.dirname(normalizedRoute);
  const baseName = path.posix.basename(normalizedRoute);
  const routeFileName = method ? `${baseName}.${method}.ts` : `${baseName}.ts`;
  const destinationDir = routeDir === '.'
    ? baseDir
    : joinPathFragments(baseDir, routeDir);
  const routePath = joinPathFragments(destinationDir, routeFileName);

  if (tree.exists(routePath)) {
    throw new Error(`API route already exists at ${routePath}.`);
  }

  generateFiles(tree, path.join(__dirname, 'files'), destinationDir, {
    routeFileName,
    tmpl: '',
  });

  await formatFiles(tree);
}

export default apiRouteGenerator;
