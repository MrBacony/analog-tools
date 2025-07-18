// update-package-versions.ts

const fs = require('fs');
const path = require('path');

// Resolve workspace root (two levels up from tools/scripts)
const WORKSPACE_ROOT = path.resolve(__dirname, '../../');
const PACKAGES_DIR = path.join(WORKSPACE_ROOT, 'packages');
const APPS_DIR = path.join(WORKSPACE_ROOT, 'apps');
const TARGET_VERSION = process.argv[2];

if (!TARGET_VERSION) {
  console.error('Usage: node update-package-versions.js <version>');
  process.exit(1);
}

function getPackageJsonPaths() {
  const dirs = [PACKAGES_DIR, APPS_DIR];
  const paths = [];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const subdirs = fs.readdirSync(dir);
    for (const sub of subdirs) {
      const pkgPath = path.join(dir, sub, 'package.json');
      if (fs.existsSync(pkgPath)) {
        paths.push(pkgPath);
      }
    }
  }
  // Also include root package.json
  const rootPkg = path.join(WORKSPACE_ROOT, 'package.json');
  if (fs.existsSync(rootPkg)) {
    paths.push(rootPkg);
  }
  return paths;
}

function updateVersions(targetVersion) {
  const pkgPaths = getPackageJsonPaths();
  const packageNames = [];

  // First, collect all package names
  for (const pkgPath of pkgPaths) {
    const content = fs.readFileSync(pkgPath, 'utf8');
    let pkg;
    try {
      pkg = JSON.parse(content);
    } catch (e) {
      console.error('Error parsing', pkgPath, e);
      continue;
    }
    if (pkg.name) {
      packageNames.push(pkg.name);
    }
  }

  // Now, update all package.json files
  for (const pkgPath of pkgPaths) {
    const content = fs.readFileSync(pkgPath, 'utf8');
    let pkg;
    try {
      pkg = JSON.parse(content);
    } catch (e) {
      console.error('Error parsing', pkgPath, e);
      continue;
    }

    let updated = false;

    // Update version if this is a managed package
    if (packageNames.includes(pkg.name)) {
      pkg.version = targetVersion;
      updated = true;
    }

    // Update dependencies and peerDependencies
    ['dependencies', 'peerDependencies'].forEach((depType) => {
      if (pkg[depType]) {
        Object.keys(pkg[depType]).forEach((dep) => {
          if (packageNames.includes(dep)) {
            pkg[depType][dep] = `^${targetVersion}`;
            updated = true;
          }
        });
      }
    });

    if (updated) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      console.log(`Updated: ${pkgPath}`);
    }
  }
}

try {
  updateVersions(TARGET_VERSION);
} catch (err) {
  console.error('Error updating versions:', err);
  process.exit(1);
}