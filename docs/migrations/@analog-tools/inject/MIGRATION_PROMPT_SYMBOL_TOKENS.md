# Migration Prompt: Symbol-based Service Tokens

> **📋 AI Assistant Ready**  
> This prompt is designed for AI coding assistants to perform automated migration from `static INJECTABLE = true` to `@Injectable()` decorator.

> **🌍 Cross-Platform**  
> Commands provided for Unix/Mac/Linux, Windows PowerShell, and Git Bash. Choose the appropriate commands for your environment.

## Overview

Migrate all injectable service classes from legacy string-based discovery (`static INJECTABLE = true`) to symbol-based tokens using the `@Injectable()` decorator. This prevents class name mangling in production builds.

## Pre-Migration Checklist

1. **Identify all injectable classes**:
   ```bash
   # Using ripgrep (fast, recommended if installed)
   rg "static INJECTABLE" -t ts -l
   
   # Using grep (universal, works everywhere)
   grep -r "static INJECTABLE" --include="*.ts" . | cut -d: -f1 | sort -u
   
   # Windows PowerShell
   Get-ChildItem -Recurse -Filter *.ts | Select-String "static INJECTABLE" | Select-Object -ExpandProperty Path -Unique
   ```

2. **Count total files to migrate**:
   ```bash
   # Using ripgrep
   rg "static INJECTABLE" -t ts -l | wc -l
   
   # Using grep
   grep -r "static INJECTABLE" --include="*.ts" . | cut -d: -f1 | sort -u | wc -l
   
   # Windows PowerShell
   (Get-ChildItem -Recurse -Filter *.ts | Select-String "static INJECTABLE" | Select-Object -ExpandProperty Path -Unique).Count
   ```

3. **Locate Vite config files** (for SSR projects):
   ```bash
   # Unix/Mac/Git Bash
   find . -name "vite.config.*"
   
   # Windows PowerShell
   Get-ChildItem -Recurse -Filter vite.config.*
   ```

4. **Verify test setup**:
   ```bash
   # Unix/Mac/Git Bash
   grep -E '"test"|"vitest"|"jest"' package.json
   
   # Windows PowerShell
   Select-String -Pattern '"test"|"vitest"|"jest"' -Path package.json
   ```

## Task: Migrate to @Injectable() Decorator

Replace legacy `static INJECTABLE = true` with `@Injectable()` decorator in all service classes.

## Step 1: Find All Injectable Classes

**Search Pattern**: `static INJECTABLE` in all TypeScript files

```bash
# Using ripgrep (fast, recommended)
rg "static INJECTABLE" -t ts -l
rg "static INJECTABLE" -t ts -l > migration-files.txt

# Using grep (universal)
grep -rl "static INJECTABLE" --include="*.ts" . > migration-files.txt

# Windows PowerShell
Get-ChildItem -Recurse -Filter *.ts | Select-String "static INJECTABLE" | Select-Object -ExpandProperty Path -Unique | Out-File migration-files.txt
```

**Action Items**:
- [ ] Generate list of all files to migrate
- [ ] Review list for any files that should be excluded
- [ ] Estimate migration time based on file count

## Step 2: Update Each File

**Search Pattern**: `static INJECTABLE = true;` within class definitions

For **each file** found:

### A. Add Import
**Changes Required**:
```typescript
// Add to top of file if not present
import { Injectable } from '@analog-tools/inject';
```

**Action Items**:
- [ ] Check if `Injectable` import already exists
- [ ] Add import after existing imports or at top of file
- [ ] Avoid duplicate imports

### B. Remove Static Property
**Changes Required**:
```typescript
// ❌ REMOVE THIS LINE
static INJECTABLE = true;
```

**Action Items**:
- [ ] Locate `static INJECTABLE = true;` in class body
- [ ] Delete entire line including semicolon
- [ ] Remove any trailing whitespace

### C. Add Decorator
**Changes Required**:
```typescript
// ❌ BEFORE
class MyService {
  static INJECTABLE = true;
  // ... rest of class
}

// ✅ AFTER
@Injectable()
class MyService {
  // ... rest of class
}
```

**Action Items**:
- [ ] Add `@Injectable()` immediately before `class` keyword
- [ ] Maintain proper indentation
- [ ] Handle `export` keyword if present (decorator goes after `export`)
- [ ] Handle `abstract` keyword if present (decorator goes before `abstract`)

## Step 3: Update Vite Config (if using AnalogJS/SSR)

**Search Pattern**: `ssr.noExternal` in `vite.config.ts` or `vite.config.js` files

**Changes Required**:
```typescript
// Add these packages to ssr.noExternal array
ssr: {
  noExternal: [
    '@analog-tools/auth',      // Add if not present
    '@analog-tools/inject',    // Add if not present
    '@analog-tools/logger',    // Add if not present
    '@analog-tools/session',   // Add if not present
  ],
},
```

**Action Items**:
- [ ] Locate `ssr.noExternal` in vite config
- [ ] Add missing `@analog-tools/*` packages
- [ ] Avoid duplicate entries
- [ ] Skip if not using AnalogJS or SSR

## Step 4: Run Tests

**Changes Required**: None, verification step

```bash
# Run all tests
pnpm test
# or for Nx monorepos
pnpm nx run-many -t test

# Or test specific project
pnpm nx test <project-name>
```

**Action Items**:
- [ ] Run full test suite
- [ ] Fix any test failures before proceeding
- [ ] Verify all services still inject correctly
- [ ] Check for circular dependency errors

## Step 5: Verify Completion

**Search Pattern**: `static INJECTABLE` in TypeScript files (should return no results)

```bash
# Using ripgrep
rg "static INJECTABLE" -t ts -g '!*.md' -g '!docs/**'

# Using grep (should return nothing)
grep -r "static INJECTABLE" --include="*.ts" --exclude-dir=docs . | grep -v ".md:"

# Windows PowerShell
Get-ChildItem -Recurse -Filter *.ts -Exclude docs | Select-String "static INJECTABLE"

# Check migration file list
# Unix/Mac
cat migration-files.txt | wc -l
grep -rl "static INJECTABLE" --include="*.ts" . | wc -l  # Should be 0

# Windows PowerShell
(Get-Content migration-files.txt).Count
(Get-ChildItem -Recurse -Filter *.ts | Select-String "static INJECTABLE").Count  # Should be 0
```

**Action Items**:
- [ ] Confirm no `static INJECTABLE` remains in source code
- [ ] Run build: `pnpm build` or `pnpm nx build <project>`
- [ ] Verify build succeeds without errors
- [ ] Clean up migration tracking files

---

## Common Patterns

### Pattern 1: Simple Service

**Search Pattern**: Plain service class with no constructor dependencies

```typescript
// ❌ BEFORE
class MyService {
  static INJECTABLE = true;
  
  doSomething() {
    return 'result';
  }
}

// ✅ AFTER
import { Injectable } from '@analog-tools/inject';

@Injectable()
class MyService {
  doSomething() {
    return 'result';
  }
}
```

**Action Items**:
- [ ] Add `Injectable` import
- [ ] Remove `static INJECTABLE = true;` line
- [ ] Add `@Injectable()` decorator before class

### Pattern 2: Service with Constructor

**Search Pattern**: Service class with constructor parameters

```typescript
// ❌ BEFORE
class DataService {
  static INJECTABLE = true;
  
  constructor(private config: Config) {}
}

// ✅ AFTER
import { Injectable } from '@analog-tools/inject';

@Injectable()
class DataService {
  constructor(private config: Config) {}
}
```

**Action Items**:
- [ ] Add `Injectable` import
- [ ] Remove `static INJECTABLE = true;` line
- [ ] Add `@Injectable()` decorator before class
- [ ] Constructor parameters remain unchanged

### Pattern 3: Abstract Class

**Search Pattern**: Abstract service classes (both base and derived need decorator)

```typescript
// ❌ BEFORE
abstract class BaseService {
  static INJECTABLE = true;
  abstract process(): void;
}

class ConcreteService extends BaseService {
  static INJECTABLE = true;
  process() { /* implementation */ }
}

// ✅ AFTER
import { Injectable } from '@analog-tools/inject';

@Injectable()
abstract class BaseService {
  abstract process(): void;
}

@Injectable()
class ConcreteService extends BaseService {
  process() { /* implementation */ }
}
```

**Action Items**:
- [ ] Add `Injectable` import (once per file)
- [ ] Remove `static INJECTABLE = true;` from both classes
- [ ] Add `@Injectable()` to BOTH base and derived classes

### Pattern 4: Test Mock

**Search Pattern**: Mock classes in test files (`.spec.ts`, `.test.ts`)

```typescript
// ❌ BEFORE (in test file)
class MockService {
  static INJECTABLE = true;
  someMethod = vi.fn();
}

// ✅ AFTER
import { Injectable } from '@analog-tools/inject';

@Injectable()
class MockService {
  someMethod = vi.fn();
}
```

**Action Items**:
- [ ] Add `Injectable` import to test file
- [ ] Remove `static INJECTABLE = true;` from mock
- [ ] Add `@Injectable()` decorator to mock class
- [ ] Verify mock still works in tests

---

## Common Issues

### Issue 1: Missing Import
**Error:** `Cannot find name 'Injectable'`

**Fix:** Add import at top of file:
```typescript
import { Injectable } from '@analog-tools/inject';
```

### Issue 2: Missing SERVICE_TOKEN
**Error:** `Service 'MyService' is missing SERVICE_TOKEN. Add @Injectable() decorator`

**Fix:** You forgot to add the decorator:
```typescript
@Injectable()  // ← Add this
class MyService {}
```

### Issue 3: Circular Dependency
**Error:** `CircularDependencyError: Circular dependency detected`

**Fix:** Use lazy injection:
```typescript
@Injectable()
class ServiceA {
  // Instead of inject() in constructor, use it in a method
  getServiceB() {
    return inject(ServiceB);
  }
}
```

---

## Automated Script (Optional)

**⚠️ Warning:** This script automates repetitive tasks but **must be reviewed manually**. Use for speeding up migration, not as a complete solution.

### Unix/Mac/Linux (Bash)

For batch processing:

```bash
#!/bin/bash
# migrate.sh - Run from project root
# Usage: ./migrate.sh

set -e  # Exit on error

echo "🔍 Finding all injectable classes..."

# Try ripgrep first, fall back to grep
if command -v rg &> /dev/null; then
  files=$(rg "static INJECTABLE" -t ts -l)
else
  files=$(grep -rl "static INJECTABLE" --include="*.ts" .)
fi

if [ -z "$files" ]; then
  echo "✅ No files found with 'static INJECTABLE'"
  exit 0
fi

file_count=$(echo "$files" | wc -l | tr -d ' ')
echo "📝 Found $file_count files to migrate"
echo ""

current=0
for file in $files; do
  current=$((current + 1))
  echo "[$current/$file_count] Processing: $file"
  
  # Add import if not present
  if ! grep -q "import.*Injectable.*from.*@analog-tools/inject" "$file"; then
    echo "  → Adding Injectable import"
    # Add import at top after existing imports
    sed -i.bak '1,/^import/s/^import/import { Injectable } from '\''@analog-tools\/inject'\'';\nimport/' "$file"
    rm "${file}.bak" 2>/dev/null || true
  else
    echo "  → Injectable import already exists"
  fi
  
  # Remove static INJECTABLE line
  echo "  → Removing static INJECTABLE"
  sed -i.bak '/static INJECTABLE = true;/d' "$file"
  rm "${file}.bak" 2>/dev/null || true
  
  # Add @Injectable() before class
  # Note: This is a basic heuristic - manual review required
  echo "  → Adding @Injectable() decorator"
  sed -i.bak 's/^\(export \)\?\(abstract \)\?class /@Injectable()\n\1\2class /' "$file"
  rm "${file}.bak" 2>/dev/null || true
  
  echo "  ✓ Done"
  echo ""
done

echo "✨ Automated migration complete!"
echo ""
echo "⚠️  IMPORTANT: Review all changes carefully!"
echo "   1. Review changes: git diff"
echo "   2. Check decorator placement manually"
echo "   3. Run tests: pnpm test"
echo "   4. Fix any issues before committing"
```

**To use the Bash script:**

```bash
# Unix/Mac/Git Bash on Windows
chmod +x migrate.sh
./migrate.sh

# Review ALL changes
git diff

# Test before proceeding
pnpm test
```

### Windows (PowerShell)

For Windows users without Git Bash:

```powershell
# migrate.ps1 - Run from project root
# Usage: .\migrate.ps1

Write-Host "🔍 Finding all injectable classes..." -ForegroundColor Cyan

$files = Get-ChildItem -Recurse -Filter *.ts | 
         Select-String "static INJECTABLE" | 
         Select-Object -ExpandProperty Path -Unique

if ($files.Count -eq 0) {
    Write-Host "✅ No files found with 'static INJECTABLE'" -ForegroundColor Green
    exit 0
}

Write-Host "📝 Found $($files.Count) files to migrate" -ForegroundColor Yellow
Write-Host ""

$current = 0
foreach ($file in $files) {
    $current++
    Write-Host "[$current/$($files.Count)] Processing: $file" -ForegroundColor White
    
    $content = Get-Content $file -Raw
    
    # Add import if not present
    if ($content -notmatch "import.*Injectable.*from.*@analog-tools/inject") {
        Write-Host "  → Adding Injectable import" -ForegroundColor Gray
        $content = "import { Injectable } from '@analog-tools/inject';`n" + $content
    }
    
    # Remove static INJECTABLE line
    Write-Host "  → Removing static INJECTABLE" -ForegroundColor Gray
    $content = $content -replace "\s*static\s+INJECTABLE\s*=\s*true;?\s*`n", ""
    
    # Add @Injectable() before class (basic heuristic)
    Write-Host "  → Adding @Injectable() decorator" -ForegroundColor Gray
    $content = $content -replace "(export\s+)?(abstract\s+)?class\s+", "@Injectable()`n`$1`$2class "
    
    # Write back to file
    Set-Content -Path $file -Value $content -NoNewline
    
    Write-Host "  ✓ Done" -ForegroundColor Green
    Write-Host ""
}

Write-Host "✨ Automated migration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT: Review all changes carefully!" -ForegroundColor Yellow
Write-Host "   1. Review changes: git diff"
Write-Host "   2. Check decorator placement manually"
Write-Host "   3. Run tests: pnpm test"
Write-Host "   4. Fix any issues before committing"
```

**To use the PowerShell script:**

```powershell
# Windows PowerShell
.\migrate.ps1

# Review ALL changes
git diff

# Test before proceeding
pnpm test
```

**Script Limitations:**
- May not handle complex import patterns
- May place decorator incorrectly in some cases
- Cannot handle multiple classes per file perfectly
- Requires manual review of every change
- Bash script requires Unix-like environment (Mac/Linux/Git Bash on Windows)
- PowerShell script is Windows-specific but can run on Mac/Linux with PowerShell Core

**Action Items After Script**:
- [ ] Review every file changed by script
- [ ] Fix any incorrect decorator placements
- [ ] Fix any import issues
- [ ] Run tests and fix failures
- [ ] Verify vite.config.ts manually

**Platform Notes:**
- **Windows users**: Use PowerShell script OR install Git Bash for Unix commands
- **Mac/Linux users**: Bash script works natively
- **All platforms**: Manual migration is always safest if scripts fail

---

## Checklist

- [ ] Pre-migration: Generated list of all files to migrate
- [ ] Updated each file (import, remove line, add decorator)
- [ ] Updated vite.config.ts ssr.noExternal (if applicable)
- [ ] Ran tests: `pnpm test` or `pnpm nx run-many -t test`
- [ ] All tests pass
- [ ] Built successfully: `pnpm build`
- [ ] Verified completion: `rg "static INJECTABLE" -t ts -g '!*.md'` returns nothing
- [ ] Reviewed changes: `git diff`
- [ ] Ready to commit changes

---

## Post-Migration Validation

### 1. Run Full Test Suite
```bash
# Standard pnpm
pnpm test

# Nx monorepo - all projects
pnpm nx run-many -t test

# Nx monorepo - specific project
pnpm nx test <project-name>
```

### 2. Build All Projects

```bash
# Standard pnpm
pnpm build

# Nx monorepo
pnpm nx run-many -t build
```

### 3. Start Development Server

```bash
# Verify app runs without errors
pnpm dev
# or
pnpm nx serve <app-name>
```

### 4. Final Verification Commands

```bash
# Unix/Mac - Should return 0 files
echo "Remaining files: $(grep -rl "static INJECTABLE" --include="*.ts" . | wc -l)"

# Windows PowerShell
Write-Host "Remaining files: $((Get-ChildItem -Recurse -Filter *.ts | Select-String 'static INJECTABLE' | Select-Object -ExpandProperty Path -Unique).Count)"

# All platforms - Should show your changes
git diff --stat

# All platforms - Check for compilation errors
pnpm tsc --noEmit
```

---

## Guard Rails

**DO NOT:**
- ❌ Skip adding the `@Injectable()` decorator after removing `static INJECTABLE`
- ❌ Remove test logic to make tests pass
- ❌ Add `expect(true).toBe(true)` to force tests to pass
- ❌ Skip testing after each file migration
- ❌ Commit changes before all tests pass
- ❌ Ignore build errors
- ❌ Remove service classes that fail to migrate

**DO:**
- ✅ Add `@Injectable()` decorator for every class that had `static INJECTABLE`
- ✅ Fix legitimate test failures by correcting the migration
- ✅ Run tests after every few file changes
- ✅ Report any circular dependency errors immediately
- ✅ Fix import organization issues
- ✅ Maintain code formatting and indentation
- ✅ Keep all existing functionality intact

---

## Notes for LLM Execution

When executing this migration:

1. **Detect platform first**:
   - Ask user or detect from context (Windows/Mac/Linux)
   - Use appropriate commands (PowerShell for Windows, bash for Unix)
   - Prefer `grep` over `rg` for universal compatibility
   - Fall back to manual search if neither tool works

2. **Work systematically**: 
   - Complete pre-migration checklist first
   - Migrate files one-by-one or in small batches
   - Test after each batch (e.g., every 5-10 files)

3. **Test frequently**:
   - Don't migrate all files before running tests
   - Run tests after vite.config changes
   - Fix failures immediately before proceeding

4. **Keep user informed**:
   - Report progress: "Migrated X of Y files"
   - Report test results after each batch
   - Report any errors immediately

5. **Handle errors promptly**:
   - If tests fail, investigate and fix before continuing
   - If circular dependency detected, report to user
   - If import fails, check package installation

6. **Create meaningful commits**:
   - Group related changes together
   - Use clear commit messages
   - Example: `feat!: migrate to @Injectable() decorator (files 1-20)`

7. **Verify decorator placement**:
   - `@Injectable()` goes BEFORE `class` keyword
   - Handle `export class` → `@Injectable() export class`
   - Handle `export abstract class` → `@Injectable() export abstract class`

8. **Track progress**:
   - Use the checklist above
   - Keep count of migrated vs remaining files
   - Report completion percentage

9. **Final verification**:
   - All tests must pass
   - Build must succeed
   - No `static INJECTABLE` should remain
   - Review changes with user before committing

---

## Summary

This migration is simple:
1. **Find** all `static INJECTABLE = true` (use `grep` for universal compatibility, `rg` for speed)
2. **Remove** that line
3. **Add** `import { Injectable }` and `@Injectable()` decorator
4. **Update** vite.config.ts (if needed)
5. **Test** to verify everything works

**Platform Support:**
- ✅ Unix/Mac/Linux (native bash)
- ✅ Windows PowerShell (native)
- ✅ Windows Git Bash (bash commands work)
- ✅ All platforms support `grep` by default
- ⚡ `rg` (ripgrep) is optional but faster

Done! 🚀
