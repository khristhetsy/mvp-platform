// `server-only` throws on import anywhere that isn't a React Server Components runtime —
// which includes vitest. In tests it is an empty module: the guard is for the Next.js
// build, where it fails the build if a "use client" file ever reaches the service-role key.
export {};
