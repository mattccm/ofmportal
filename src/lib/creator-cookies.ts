/**
 * Client-side helpers for the creator session cookies (creatorToken,
 * creatorId, creatorName, creatorEmail).
 *
 * These cookies are read by client JS, so they are NOT HttpOnly. They always
 * get path=/ and SameSite=Lax, plus Secure when the page is served over HTTPS
 * (so local http dev keeps working).
 *
 * Values are written verbatim: callers must encode them (e.g. with
 * encodeURIComponent) where needed.
 */

function secureAttr(): string {
  if (typeof window === "undefined") return "";
  return window.location.protocol === "https:" ? "; Secure" : "";
}

export function setCreatorCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secureAttr()}`;
}

export function clearCreatorCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax${secureAttr()}`;
}
