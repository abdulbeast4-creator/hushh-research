/**
 * Canvas fingerprint probe detector — API route utility.
 *
 * Evaluates a canvas API call record received by the canvas-guard route
 * and returns true when the pattern matches a known fingerprinting probe.
 *
 * Data-extraction methods recognised as sensitive:
 *   toDataURL   — serialises the full bitmap; rendering differences between
 *                 GPU, driver, and OS font stack produce a device-unique hash
 *   getImageData — exposes raw RGBA pixel buffer (same uniqueness surface)
 *   toBlob       — async variant of toDataURL
 *
 * Drawing primitives (fillRect, lineTo, stroke, arc, …) are never flagged
 * regardless of call frequency — they manipulate canvas state without
 * extracting image data.
 *
 * Detection rule: method is in SENSITIVE_METHODS AND callCount > 5.
 * callCount of exactly 5 is NOT flagged; 6 is the first positive case.
 */

const SENSITIVE_METHODS = new Set(["toDataURL", "getImageData", "toBlob"]);

/** Minimum call count that triggers a fingerprint flag. */
const CALL_COUNT_THRESHOLD = 5;

/**
 * isCanvasFingerprintAttempt(ctxMethodName, callCount)
 *
 * @param ctxMethodName  Canvas context method name (case-sensitive)
 * @param callCount      Number of times the method was invoked
 * @returns true when the pattern signals a fingerprint probe; false otherwise
 */
export function isCanvasFingerprintAttempt(
  ctxMethodName: unknown,
  callCount: unknown
): boolean {
  if (
    typeof ctxMethodName !== "string" ||
    ctxMethodName.trim() === ""
  ) {
    return false;
  }

  if (
    typeof callCount !== "number" ||
    !isFinite(callCount) ||
    callCount < 0
  ) {
    return false;
  }

  return SENSITIVE_METHODS.has(ctxMethodName) && callCount > CALL_COUNT_THRESHOLD;
}
