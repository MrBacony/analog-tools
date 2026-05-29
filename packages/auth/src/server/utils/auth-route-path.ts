/** Returns true if path refers to an auth route, regardless of /api prefix */
export function isAuthRoutePath(path: string): boolean {
  const normalized = path.startsWith('/api') ? path : `/api${path}`;
  return normalized.startsWith('/api/auth/') || normalized === '/api/auth';
}

/** Normalizes /auth/* → /api/auth/* for internal dispatch */
export function normalizeAuthPath(path: string): string {
  if (path.startsWith('/auth/') || path === '/auth') {
    return `/api${path}`;
  }

  return path;
}