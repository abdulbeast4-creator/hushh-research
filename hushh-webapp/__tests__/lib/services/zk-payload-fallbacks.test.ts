import { describe, expect, it } from "vitest";

/**
 * Characterization: zero-knowledge KYC payload field-requirement fallbacks.
 *
 * Verified repo truth (truth-first)
 * ---------------------------------
 * The public ZK client boundary lives in
 * `hushh-webapp/lib/services/one-kyc-client-zk-service.ts`. It exposes the
 * `OneKycClientZkService` class (connector key management + scoped-export
 * decryption — all crypto/network gated) alongside several PURE exported
 * helpers that map raw request descriptors into the field structure the
 * zero-knowledge draft builder consumes. Those pure helpers are the only part
 * exercisable deterministically without crypto, network, or DOM:
 *
 *   - `effectiveOneKycRequiredFields({ requiredFields?, scopes?, fallbackScope? })`
 *     resolves the ordered set of required disclosure fields for one or more
 *     consent scopes. It deliberately drops back into an explicit DEFAULT
 *     structure (`["identity_profile"]`) when the raw payload arrives without
 *     valid scope wrappers — i.e. no scopes, null/empty/whitespace entries, or
 *     a missing `fallbackScope`.
 *   - `isKeywordOnlyInstruction(instruction)` — a pure guard used in the redraft
 *     path; verified here for graceful handling of empty / non-string-ish input.
 *
 * This suite pins how the parser maps inputs when raw string payload items
 * arrive WITHOUT valid cryptographic / scope wrappers, asserting it never throws
 * and always resolves to a well-formed, de-duplicated string[] (defaulting to
 * the identity profile structure). No production source is modified.
 */

import {
  effectiveOneKycRequiredFields,
  isKeywordOnlyInstruction,
} from "@/lib/services/one-kyc-client-zk-service";

const DEFAULT_IDENTITY_STRUCTURE = ["identity_profile"];

describe("effectiveOneKycRequiredFields · missing/invalid wrapper fallbacks", () => {
  it("falls back to the default identity structure when no scopes or fallback are provided", () => {
    expect(effectiveOneKycRequiredFields({})).toEqual(DEFAULT_IDENTITY_STRUCTURE);
    expect(
      effectiveOneKycRequiredFields({ requiredFields: [], scopes: [], fallbackScope: null })
    ).toEqual(DEFAULT_IDENTITY_STRUCTURE);
  });

  it("ignores null / undefined / empty scope entries and still resolves cleanly", () => {
    const result = effectiveOneKycRequiredFields({
      scopes: [null, undefined, ""],
    });
    expect(result).toEqual(DEFAULT_IDENTITY_STRUCTURE);
  });

  it("treats a raw unwrapped string payload (no valid scope) via the fallback path", () => {
    // A plain string that is not a structured `attr.*` scope: the parser
    // cannot derive fields from it and drops back to the default structure.
    const result = effectiveOneKycRequiredFields({
      requiredFields: [],
      scopes: ["not-a-real-scope"],
      fallbackScope: null,
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(DEFAULT_IDENTITY_STRUCTURE);
  });

  it("uses fallbackScope when the scopes array is missing entirely", () => {
    const result = effectiveOneKycRequiredFields({
      fallbackScope: "attr.identity.*",
    });
    expect(result).toContain("identity_profile");
  });

  it("never throws and always returns string[] for arbitrary malformed inputs", () => {
    const malformedCases: Array<Parameters<typeof effectiveOneKycRequiredFields>[0]> = [
      { requiredFields: null, scopes: null, fallbackScope: undefined },
      { scopes: ["", "   ", "\t"] },
      { requiredFields: ["full_name"], scopes: [""] },
      { requiredFields: [], scopes: [undefined as unknown as string] },
      { fallbackScope: "" },
    ];
    for (const input of malformedCases) {
      let result: string[] | undefined;
      expect(() => {
        result = effectiveOneKycRequiredFields(input);
      }).not.toThrow();
      expect(Array.isArray(result)).toBe(true);
      for (const field of result as string[]) {
        expect(typeof field).toBe("string");
      }
    }
  });

  it("de-duplicates fields when overlapping scopes are supplied", () => {
    const result = effectiveOneKycRequiredFields({
      scopes: ["attr.identity.*", "attr.identity.*"],
    });
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });

  it("maps a structured financial scope to its financial field structure", () => {
    const result = effectiveOneKycRequiredFields({
      scopes: ["attr.financial.*"],
    });
    expect(result).toContain("financial_information");
    expect(result).not.toContain("identity_profile");
  });
});

describe("isKeywordOnlyInstruction · graceful handling of unwrapped input", () => {
  it("does not throw and returns a boolean for empty / nullish-like input", () => {
    for (const value of ["", "   ", "\t\n"]) {
      let result: boolean | undefined;
      expect(() => {
        result = isKeywordOnlyInstruction(value);
      }).not.toThrow();
      expect(typeof result).toBe("boolean");
    }
  });

  it("returns false for clearly substantive free-text instructions", () => {
    expect(
      isKeywordOnlyInstruction("Please rewrite the disclosure to be more formal")
    ).toBe(false);
  });
});
