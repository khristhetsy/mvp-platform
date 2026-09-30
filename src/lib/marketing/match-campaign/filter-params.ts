/**
 * The founder list filter as it travels between the editor and the API:
 * query string for the list step, JSON body for "select all". Client safe.
 */
import type { FounderType } from "./types";

export type FounderFilterInput = {
  list?: string | null;
  types?: FounderType[];
  industries?: string[];
  stages?: string[];
  pipeline?: string[];
  filled?: boolean;
  q?: string | null;
};

const TYPES: FounderType[] = ["lead", "existing_user", "in_pipeline"];

export function filterToQuery(f: FounderFilterInput, limit = 200): string {
  const p = new URLSearchParams();
  if (f.list) p.set("list", f.list);
  for (const t of f.types ?? []) p.append("type", t);
  for (const v of f.industries ?? []) p.append("industry", v);
  for (const v of f.stages ?? []) p.append("stage", v);
  for (const v of f.pipeline ?? []) p.append("pipeline", v);
  if (f.filled) p.set("filled", "1");
  if (f.q?.trim()) p.set("q", f.q.trim());
  p.set("limit", String(limit));
  return p.toString();
}

export function filterFromQuery(p: URLSearchParams): FounderFilterInput {
  return {
    list: p.get("list") || null,
    types: p.getAll("type").filter((t): t is FounderType => (TYPES as string[]).includes(t)),
    industries: p.getAll("industry"),
    stages: p.getAll("stage"),
    pipeline: p.getAll("pipeline"),
    filled: p.get("filled") === "1",
    q: p.get("q") || null,
  };
}

export function sanitizeFilter(raw: unknown): FounderFilterInput {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    list: typeof r.list === "string" ? r.list : null,
    types: strs(r.types).filter((t): t is FounderType => (TYPES as string[]).includes(t)),
    industries: strs(r.industries),
    stages: strs(r.stages),
    pipeline: strs(r.pipeline),
    filled: r.filled === true,
    q: typeof r.q === "string" ? r.q : null,
  };
}
