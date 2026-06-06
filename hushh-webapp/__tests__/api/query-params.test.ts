import { describe, expect, it } from "vitest";

import { parseQueryArray } from "@/app/api/_utils/query-params";

// ---------------------------------------------------------------------------
// parseQueryArray — single-value coercion contract
// ---------------------------------------------------------------------------

describe("parseQueryArray", () => {
  it("wraps a single string value into a one-element array", () => {
    const params = new URLSearchParams("filter=admin");
    expect(parseQueryArray(params, "filter")).toEqual(["admin"]);
  });

  it("preserves all values when the key appears multiple times", () => {
    const params = new URLSearchParams("filter=admin&filter=user");
    expect(parseQueryArray(params, "filter")).toEqual(["admin", "user"]);
  });

  it("returns an empty array when the key is absent", () => {
    const params = new URLSearchParams("");
    expect(parseQueryArray(params, "filter")).toEqual([]);
  });

  it("always returns an array — never a raw string primitive", () => {
    const params = new URLSearchParams("role=editor");
    const result = parseQueryArray(params, "role");
    expect(Array.isArray(result)).toBe(true);
  });

  it("is safe to call .map() on a single-value result without throwing", () => {
    const params = new URLSearchParams("scope=read");
    const upper = parseQueryArray(params, "scope").map((s) => s.toUpperCase());
    expect(upper).toEqual(["READ"]);
  });

  it("preserves insertion order for three or more repeated values", () => {
    const params = new URLSearchParams("tag=a&tag=b&tag=c");
    expect(parseQueryArray(params, "tag")).toEqual(["a", "b", "c"]);
  });

  it("returns an independent empty array for an unknown key", () => {
    const params = new URLSearchParams("filter=admin");
    expect(parseQueryArray(params, "unknown")).toEqual([]);
  });
});
