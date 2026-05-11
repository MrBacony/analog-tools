const SAME_ORIGIN_BASE_URL = 'http://analog-tools.local';

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const characterCode = character.charCodeAt(0);

    if (characterCode <= 0x1f || characterCode === 0x7f) {
      return true;
    }
  }

  return false;
}

export function sanitizeRedirectUrl(redirectUrl: unknown): string {
  if (typeof redirectUrl !== 'string') {
    return '/';
  }

  const normalizedRedirectUrl = redirectUrl.trim();

  if (
    normalizedRedirectUrl === '' ||
    !normalizedRedirectUrl.startsWith('/') ||
    normalizedRedirectUrl.startsWith('//') ||
    normalizedRedirectUrl.includes('\\') ||
    containsControlCharacter(normalizedRedirectUrl)
  ) {
    return '/';
  }

  try {
    const parsedUrl = new URL(normalizedRedirectUrl, SAME_ORIGIN_BASE_URL);

    if (parsedUrl.origin !== SAME_ORIGIN_BASE_URL) {
      return '/';
    }

    const safeRedirectUrl = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;

    return safeRedirectUrl.startsWith('//') ? '/' : safeRedirectUrl;
  } catch {
    return '/';
  }
}
