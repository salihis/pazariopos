// packages/core/src/test/setup.ts
// Runs once before every test file in this package (see vitest.config.ts
// `setupFiles`). Keep this file free of test-specific mocks — those belong
// in the individual *.test.ts files so each suite's assumptions stay local
// and visible.

// jsdom does not implement fetch; individual tests stub it per-case with
// vi.stubGlobal('fetch', ...), but we still want a safe default so any
// service constructed at import-time (singletons!) doesn't throw before a
// test gets the chance to install its own stub.
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = (async () => new Response(null, { status: 200 })) as typeof fetch
}
