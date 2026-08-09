#!/usr/bin/env node

/**
 * Writes a publishable package.json into a package's build output.
 *
 * The library builds use Vite in library mode with
 * `outDir: ../../node_modules/@analog-tools/<pkg>` and `emptyOutDir: true`, so
 * the output holds bundles and type declarations but no manifest - and anything
 * placed there before the build is wiped. Without this step `pnpm publish`
 * has no package.json to publish from.
 *
 * `workspace:` ranges are resolved to concrete versions on the way out. They
 * only mean something inside this workspace, and `pnpm publish` runs from
 * node_modules/<name>, which is not a workspace project, so pnpm cannot
 * resolve them itself.
 *
 * Usage: node tools/scripts/prepare-package-manifest.js <package-directory>
 *   e.g. node tools/scripts/prepare-package-manifest.js inject
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE_ROOT = path.resolve(__dirname, '../../');
const PACKAGES_DIR = path.join(WORKSPACE_ROOT, 'packages');

/**
 * Map every workspace package name to the version in its source manifest.
 */
function readWorkspaceVersions() {
  const versions = new Map();

  for (const entry of fs.readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const manifestPath = path.join(PACKAGES_DIR, entry.name, 'package.json');
    if (!fs.existsSync(manifestPath)) continue;

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.name && manifest.version) {
      versions.set(manifest.name, manifest.version);
    }
  }

  return versions;
}

/** A plain semver range: optional comparators, then a digit. */
const SEMVER_RANGE = /^[v=><~^\s]*\d/;

/**
 * Translate a single `workspace:` range into a publishable one.
 * `workspace:*` becomes the exact version, `workspace:^`/`workspace:~` keep
 * their range prefix, and an explicit range (`workspace:^1.2.3`) is passed
 * through with the protocol stripped.
 *
 * Every other form is rejected rather than passed along. An empty specifier
 * would publish as "any version", and path or alias forms would publish a
 * specifier npm cannot install - both silently, which is worse than failing
 * the build here.
 */
function resolveWorkspaceRange(range, version, name) {
  const specifier = range.slice('workspace:'.length);

  if (specifier === '*') return version;
  if (specifier === '^' || specifier === '~') return `${specifier}${version}`;
  if (SEMVER_RANGE.test(specifier)) return specifier;

  throw new Error(
    `Unsupported workspace range "${range}" for "${name}": expected workspace:*, workspace:^, workspace:~ or an explicit semver range.`
  );
}

/**
 * Replace all `workspace:` ranges in the manifest's dependency sections.
 * Throws when a workspace dependency cannot be resolved, so a broken manifest
 * fails the build instead of reaching npm.
 */
function resolveWorkspaceDependencies(manifest, versions) {
  for (const section of [
    'dependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    const deps = manifest[section];
    if (!deps) continue;

    for (const [name, range] of Object.entries(deps)) {
      if (typeof range !== 'string' || !range.startsWith('workspace:')) continue;

      const version = versions.get(name);
      if (!version) {
        throw new Error(
          `Cannot resolve "${range}" for ${section} entry "${name}": no workspace package with that name.`
        );
      }

      deps[name] = resolveWorkspaceRange(range, version, name);
      console.log(`Resolved ${section} "${name}": ${range} -> ${deps[name]}`);
    }
  }
}

function main() {
  const packageDir = process.argv[2];

  if (!packageDir) {
    console.error(
      'Usage: node tools/scripts/prepare-package-manifest.js <package-directory>'
    );
    process.exit(1);
  }

  const sourcePath = path.join(PACKAGES_DIR, packageDir, 'package.json');
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`No package.json at ${path.relative(WORKSPACE_ROOT, sourcePath)}`);
  }

  const manifest = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  if (!manifest.name) {
    throw new Error(`${path.relative(WORKSPACE_ROOT, sourcePath)} has no "name" field`);
  }

  const outDir = path.join(WORKSPACE_ROOT, 'node_modules', manifest.name);

  // A missing output directory means the bundles were never built. Writing a
  // manifest next to nothing would produce an empty published package, so stop.
  if (!fs.existsSync(outDir)) {
    throw new Error(
      `Build output missing at node_modules/${manifest.name}. Run the package's build first.`
    );
  }

  resolveWorkspaceDependencies(manifest, readWorkspaceVersions());

  const outPath = path.join(outDir, 'package.json');
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`Wrote node_modules/${manifest.name}/package.json`);
}

try {
  main();
} catch (error) {
  console.error('Error preparing package manifest:', error.message);
  process.exit(1);
}
