/**
 * Consent purpose validator — request-boundary allowlist enforcement.
 *
 * Called inside the consent approval route before any payload is forwarded
 * to the backend. A request that declares an unrecognised purpose is
 * rejected at the Next.js edge rather than reaching the Python service.
 */

/** Canonical tier list.  Every permitted purpose must be listed here. */
export const APPROVED_CONSENT_PURPOSES = [
  "essential",       // core functionality required for service operation
  "analytics",       // aggregate usage analytics — no PII export
  "marketing",       // opted-in promotional communications
  "personalization", // user-experience customisation
  "research",        // internal research with consent on file
] as const;

export type ConsentPurpose = (typeof APPROVED_CONSENT_PURPOSES)[number];

/**
 * isPurposeValid(requestedPurpose, allowedPurposes)
 *
 * Returns true only when `requestedPurpose` is a non-empty string that is
 * present in `allowedPurposes`.  Every other input — null, undefined,
 * empty string, wrong type, or a value not in the list — returns false
 * (default-deny posture).
 *
 * Lookup uses Array.prototype.includes(), which applies SameValueZero
 * equality (equivalent to ===).  "ANALYTICS" does NOT match "analytics".
 */
export function isPurposeValid(
  requestedPurpose: unknown,
  allowedPurposes: readonly string[]
): boolean {
  if (
    requestedPurpose === null ||
    requestedPurpose === undefined ||
    typeof requestedPurpose !== "string" ||
    requestedPurpose.trim() === ""
  ) {
    return false;
  }

  if (!Array.isArray(allowedPurposes) || allowedPurposes.length === 0) {
    return false;
  }

  return (allowedPurposes as string[]).includes(requestedPurpose);
}
