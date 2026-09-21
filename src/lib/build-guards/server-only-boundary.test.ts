/**
 * No client component may reach a `server-only` module.
 *
 * This exists because it cost a deployment. `AccountActivityClient` imported
 * `DATE_RANGES` — a plain array of strings — from `lib/activity/feed.ts`, which
 * carries `import "server-only"` because it also reads Supabase with the
 * service-role client. tsc was happy, eslint was happy, every test passed, and
 * Turbopack failed the production build with "You're importing a module that
 * depends on server-only".
 *
 * The trap is that a TYPE import from the same module is fine — it erases
 * before the bundler sees it — so the same file can import types from a
 * server-only module safely and a value from it fatally. That distinction is
 * invisible on review, which is why it needs a machine.
 *
 * The fix when this fails is always the same: move the pure part (types,
 * constants, arithmetic) into a sibling module with no `server-only`, and
 * re-export it from the server module so server callers keep one import path.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

const files = walk(SRC);
const source = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));

function resolveImport(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null; // node_modules — not ours to police

  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Only VALUE imports matter. `import type { X } from "…"` and a named clause
 * where every specifier is `type X` are both erased by the compiler, so they
 * never reach the bundler and never trip the server-only guard.
 */
function valueImports(code: string, from: string): string[] {
  const out: string[] = [];

  const named = /import\s+(?!type\s)([\s\S]*?)from\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = named.exec(code))) {
    const specifiers = m[1]
      .replace(/[{}]/g, "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (specifiers.length && specifiers.every((s) => s.startsWith("type "))) continue;
    const resolved = resolveImport(m[2], from);
    if (resolved) out.push(resolved);
  }

  // Side-effect imports: `import "server-only"` itself is one of these.
  const bare = /import\s+["']([^"']+)["']/g;
  while ((m = bare.exec(code))) {
    const resolved = resolveImport(m[1], from);
    if (resolved) out.push(resolved);
  }

  return out;
}

const isServerOnly = (file: string) =>
  /^\s*import\s+["']server-only["']/m.test(source.get(file) ?? "");

const clientComponents = files.filter((f) => /^\s*["']use client["']/.test(source.get(f) ?? ""));

/** The shortest import chain from a client component into server-only code. */
function findServerOnlyPath(entry: string): string[] | null {
  const seen = new Set<string>();
  const queue: Array<[string, string[]]> = [[entry, [entry]]];

  while (queue.length) {
    const [current, path] = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);

    if (current !== entry && isServerOnly(current)) return path;

    for (const dep of valueImports(source.get(current) ?? "", current)) {
      queue.push([dep, [...path, dep]]);
    }
  }
  return null;
}

describe("the server-only boundary holds", () => {
  it("finds client components to check", () => {
    // A zero here would mean the detector is broken and every other assertion
    // in this file is vacuously true.
    expect(clientComponents.length).toBeGreaterThan(100);
  });

  it("finds modules that are actually marked server-only", () => {
    expect(files.filter(isServerOnly).length).toBeGreaterThan(0);
  });

  it("no client component imports a value from a server-only module", () => {
    const violations = clientComponents
      .map((entry) => ({ entry, path: findServerOnlyPath(entry) }))
      .filter((v): v is { entry: string; path: string[] } => v.path !== null)
      .map(({ path }) => path.map((p) => p.replace(`${ROOT}/`, "")).join("\n      -> "));

    expect(
      violations,
      violations.length
        ? `\n\n${violations.length} client component(s) reach server-only code:\n\n  ${violations.join(
            "\n\n  ",
          )}\n\nMove the pure part into a sibling module and re-export it from the server module.\n`
        : "",
    ).toEqual([]);
  });
});
