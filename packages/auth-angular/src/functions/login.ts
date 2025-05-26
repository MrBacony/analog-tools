export function redirect(uri: string) {
  document.location.href = uri;
}

export function login(redirectUri?: string) {
  const url = document.location.origin + (redirectUri || '');
  redirect(`/api/auth/login?redirect_uri=${encodeURIComponent(url)}`);
}
