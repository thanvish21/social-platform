'use client';

/** localStorage-backed token storage. Centralized so the Apollo links
 *  and auth hook share one source of truth. */

const ACCESS_KEY = 'sp_access_token';
const REFRESH_KEY = 'sp_refresh_token';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  window.localStorage.setItem(ACCESS_KEY, accessToken);
  window.localStorage.setItem(REFRESH_KEY, refreshToken);
  window.dispatchEvent(new Event('auth-changed'));
}

export function clearTokens(): void {
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.dispatchEvent(new Event('auth-changed'));
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}
