/**
 * Token expiry guard — request-boundary TTL enforcement.
 *
 * Called inside the session creation route to reject ID tokens whose
 * issuance timestamp indicates they are older than the maximum accepted
 * age.  This is a defence-in-depth check: it runs before the Firebase
 * Admin SDK call and prevents the backend from receiving a stale token
 * even if the Firebase expiry window has not yet closed.
 */

/**
 * isTokenExpired(tokenPayload, ttlInSeconds)
 *
 * Returns true (expired / invalid) when:
 *   • tokenPayload is not a plain non-null object
 *   • tokenPayload.createdAt is missing, NaN, Infinite, ≤ 0, or non-numeric
 *   • ttlInSeconds is missing, NaN, Infinite, negative, or non-numeric
 *   • Date.now() >= createdAt + ttlInSeconds * 1000
 *     ('>=' means the token is expired at the exact millisecond of expiry)
 *
 * Returns false only when the token is a well-formed object whose creation
 * timestamp is within the permitted TTL window.
 *
 * @param tokenPayload   Object with a numeric `createdAt` field (epoch ms)
 * @param ttlInSeconds   Token time-to-live in seconds (non-negative finite)
 */
export function isTokenExpired(
  tokenPayload: unknown,
  ttlInSeconds: number
): boolean {
  if (
    tokenPayload === null ||
    tokenPayload === undefined ||
    typeof tokenPayload !== "object" ||
    Array.isArray(tokenPayload)
  ) {
    return true;
  }

  const payload = tokenPayload as Record<string, unknown>;
  const createdAt = payload["createdAt"];

  if (
    createdAt === null ||
    createdAt === undefined ||
    typeof createdAt !== "number" ||
    !isFinite(createdAt) ||
    createdAt <= 0
  ) {
    return true;
  }

  if (
    typeof ttlInSeconds !== "number" ||
    !isFinite(ttlInSeconds) ||
    ttlInSeconds < 0
  ) {
    return true;
  }

  return Date.now() >= createdAt + ttlInSeconds * 1000;
}
