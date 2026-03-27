import { logger } from '@nx/devkit';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ensureAuthInterceptorFeature } from './init-auth';

describe('ensureAuthInterceptorFeature', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the original content and warns when provideHttpClient is missing', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const content = `export const appConfig = { providers: [] };`;

    const result = ensureAuthInterceptorFeature(content);

    expect(result).toBe(content);
    expect(warnSpy).toHaveBeenCalledWith(
      'provideHttpClient() not found in app.config.ts. Skipping interceptor update.'
    );
  });

  it('appends withInterceptors when provideHttpClient has existing features', () => {
    const content = `provideHttpClient(withFetch())`;

    const result = ensureAuthInterceptorFeature(content);

    expect(result).toBe(
      `provideHttpClient(withFetch(), withInterceptors([authInterceptor]))`
    );
  });

  it('adds withInterceptors when provideHttpClient has no arguments', () => {
    const content = `provideHttpClient()`;

    const result = ensureAuthInterceptorFeature(content);

    expect(result).toBe(`provideHttpClient(withInterceptors([authInterceptor]))`);
  });

  it('appends authInterceptor to an existing withInterceptors array', () => {
    const content =
      'provideHttpClient(withFetch(), withInterceptors([existingInterceptor]))';

    const result = ensureAuthInterceptorFeature(content);

    expect(result).toBe(
      'provideHttpClient(withFetch(), withInterceptors([existingInterceptor, authInterceptor]))'
    );
  });

  it('adds authInterceptor to an empty withInterceptors array', () => {
    const content = 'provideHttpClient(withFetch(), withInterceptors([]))';

    const result = ensureAuthInterceptorFeature(content);

    expect(result).toBe(
      'provideHttpClient(withFetch(), withInterceptors([authInterceptor]))'
    );
  });

  it('returns the original content when authInterceptor is already present', () => {
    const content =
      'provideHttpClient(withFetch(), withInterceptors([existingInterceptor, authInterceptor]))';

    const result = ensureAuthInterceptorFeature(content);

    expect(result).toBe(content);
  });
});