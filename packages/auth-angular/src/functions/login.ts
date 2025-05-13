export function login(redirectUri?: string) {
  const url = document.location.origin + redirectUri;
  document.location.href = `/api/auth/login?redirect_uri=${encodeURIComponent(
    url
  )}`;
}
