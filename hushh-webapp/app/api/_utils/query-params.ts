// app/api/_utils/query-params.ts
//
// Normalises repeatable query parameters to a uniform string array so that
// callers can safely call .map()/.filter() without branching on whether the
// consumer sent one value or many.
//
// URLSearchParams.get() returns a bare string for a single occurrence, which
// causes array operations to throw when a caller sends ?key=value instead of
// ?key=a&key=b.  getAll() always returns string[], making the shape stable.

export function parseQueryArray(
  searchParams: URLSearchParams,
  key: string,
): string[] {
  return searchParams.getAll(key);
}
