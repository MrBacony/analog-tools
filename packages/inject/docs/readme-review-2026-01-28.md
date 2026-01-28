# README Review - @analog-tools/inject

**Date:** 2026-01-28  
**Health Score:** 7.5/10

## Executive Summary

The inject package README is well-structured with direct, technical writing and comprehensive documentation of core features. However, it contains critical inconsistencies where code examples use deprecated v1 syntax (`static INJECTABLE = true`) instead of the current `@Injectable()` decorator, and several exported APIs are undocumented.

### Key Strengths
- Excellent structure with comprehensive table of contents
- No AI slop — direct, technical writing throughout
- Thorough async lifecycle documentation with real-world examples
- Migration guide from v1 is linked and accurate

### Critical Gaps
- Scoped injection examples use deprecated v1 pattern
- Three exported functions undocumented (`hasService`, `tryInject`, `InjectionError`)
- Limitations section references outdated v1 disambiguation pattern

## Validation Report

### Critical Errors 🚨

| Issue | Location | Description |
|-------|----------|-------------|
| Deprecated syntax | Scoped Injection > Test Isolation Example | Uses `static readonly INJECTABLE = true` instead of `@Injectable()` |
| Deprecated syntax | Scoped Injection > Hierarchical Scopes | Uses `static readonly INJECTABLE = true` instead of `@Injectable()` |
| Outdated advice | Limitations section | States "Use a string INJECTABLE token to disambiguate" — v2 uses `@Injectable(customSymbol)` |

### Missing Documentation

| Export | Type | Impact |
|--------|------|--------|
| `hasService<T>(token)` | Function | Devs may not know they can check registration status |
| `tryInject<T>(token)` | Function | Alternative to `inject(token, { required: false })` |
| `InjectionError` | Class | Error type thrown by inject utilities |
| `MissingServiceTokenError` | Class | Mentioned in docs but not in API Reference |

### AI Slop Detected 🗑️

None detected. Writing is direct and technical throughout.

## Findings by Priority

### 🚨 Critical — Blocks Correct Usage

**1. Scoped injection examples use deprecated v1 syntax**

The "Test Isolation Example" and "Hierarchical Scopes" sections show:
```typescript
class DatabaseService {
  static readonly INJECTABLE = true;  // ❌ v1 pattern
  // ...
}
```

Should be:
```typescript
@Injectable()
class DatabaseService {
  // ...
}
```

**2. Limitations section references deprecated pattern**

Current text:
> **Class name collisions** -- two different classes with the same `.name` property will conflict in the registry. Use a string `INJECTABLE` token to disambiguate.

This is v1 advice. In v2, symbol-based tokens prevent conflicts automatically. If disambiguation is needed, use `@Injectable(customSymbol)`.

### 🔥 High — Significant DX Improvement

**3. Undocumented exported APIs**

Add to API Reference:

| Function | Signature | Description |
|----------|-----------|-------------|
| `hasService<T>` | `(token: InjectionServiceClass<T>) => boolean` | Check if a service is registered |
| `tryInject<T>` | `(token: InjectionServiceClass<T>) => T \| undefined` | Inject without throwing; returns `undefined` if not found |

Add Error Types section:

| Error | When Thrown |
|-------|-------------|
| `InjectionError` | Base error for injection failures |
| `MissingServiceTokenError` | Service class missing `@Injectable()` decorator |

### ✨ Medium — Quality Enhancement

**4. Installation section — add package manager alternatives**

Current:
```bash
npm install @analog-tools/inject
```

Recommended:
```bash
# npm
npm install @analog-tools/inject

# yarn
yarn add @analog-tools/inject

# pnpm
pnpm add @analog-tools/inject
```

**5. Missing badges**

Consider adding:
- Build status badge (GitHub Actions)
- Test coverage badge

### 💎 Low — Polish

**6. Document length**

The README is ~500 lines. Consider:
- Moving detailed lifecycle examples to a separate `/docs/lifecycle.md` 
- Using collapsible `<details>` sections for extensive examples

## Implementation Roadmap

### Phase 1 — Critical Fixes (< 30 min)

1. Fix `Test Isolation Example` — replace `static readonly INJECTABLE = true` with `@Injectable()` decorator
2. Fix `Hierarchical Scopes` example — same change
3. Update Limitations section — replace string token advice with symbol-based token advice

### Phase 2 — API Documentation (< 1 hour)

1. Add `hasService<T>()` to API Reference
2. Add `tryInject<T>()` to API Reference  
3. Add Error Types section with `InjectionError` and `MissingServiceTokenError`

### Phase 3 — Enhancements (Optional)

1. Add yarn/pnpm installation alternatives
2. Add build/coverage badges
3. Consider extracting lifecycle examples to separate doc

## Conclusion

The README is solid overall with excellent technical writing and no AI slop. The critical fixes are straightforward — update deprecated v1 code examples to v2 `@Injectable()` syntax. Adding the missing API documentation will make the package fully self-documenting.
