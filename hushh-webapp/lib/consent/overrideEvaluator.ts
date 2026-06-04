/**
 * Consent override evaluator — two-tier cascade resolver.
 *
 * Called inside the consent revocation route to determine the effective
 * consent state before forwarding to the backend.  If the resolved state
 * is already inactive, the backend call is skipped and an early response
 * is returned — preventing no-op revocations from reaching the service.
 *
 * Cascade priority:
 *   Tier 1 — localOverride (explicit boolean) takes absolute precedence.
 *             A local false MUST be able to revoke a global true.
 *   Tier 2 — globalStatus fallback when no local override is supplied.
 *   Tier 3 — default-deny (false) when both are absent or non-boolean.
 */

/**
 * resolveConsentState(globalStatus, localOverride)
 *
 * Returns the effective boolean consent state from the two-tier cascade.
 * Only primitive boolean values are treated as meaningful consent signals —
 * strings, numbers, and other truthy/falsy values fall through to the next
 * tier or default-deny.
 *
 * @param globalStatus   Broad / system-level consent flag
 * @param localOverride  Per-entity override; absent means "not set"
 * @returns Resolved boolean — always a strict boolean, never truthy/falsy
 */
export function resolveConsentState(
  globalStatus: unknown,
  localOverride: unknown
): boolean {
  if (typeof localOverride === "boolean") return localOverride; // Tier 1
  if (typeof globalStatus === "boolean") return globalStatus;  // Tier 2
  return false;                                                 // Tier 3
}
