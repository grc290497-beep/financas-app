export const DEFAULT_AFTER_LOGIN = "/app";

/**
 * Returns a same-origin path to redirect to after auth, or the default.
 * Rejects absolute URLs and protocol-relative paths ("//evil.com") so a
 * crafted ?next= cannot send the user to another site.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_AFTER_LOGIN;
  }
  return next;
}
