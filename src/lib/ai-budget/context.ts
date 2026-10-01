// Request-scoped override for which budget category a paid AI call bills to.
// Shared helpers (IR summaries, CEO briefing, document summaries) serve more
// than one area; the entry point that knows the area wraps its work in
// withAiUsage(...) and every call inside bills there.
//
// Uses the AsyncLocalStorage that Next.js puts on globalThis in its Node and
// edge runtimes, rather than importing node:async_hooks, so modules that a
// client component reaches for a constant still bundle.
import type { AiUsageTag } from "./config";

type Ctx = Partial<AiUsageTag> & { profileId?: string | null };
type Store = { run<T>(ctx: Ctx, fn: () => T): T; getStore(): Ctx | undefined };

const ALS = (globalThis as { AsyncLocalStorage?: new () => Store }).AsyncLocalStorage;
const store: Store | null = ALS ? new ALS() : null;

export function withAiUsage<T>(tag: Ctx, fn: () => Promise<T>): Promise<T> {
  if (!store) return fn();
  return store.run({ ...(store.getStore() ?? {}), ...tag }, fn);
}

export function currentAiUsage(): Ctx | undefined {
  return store?.getStore();
}
