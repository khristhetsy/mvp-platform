/**
 * Menu search for the Cmd+K search box. Pure functions, no I/O.
 *
 * The page list is read from the live navigation config, so a page that is
 * added, renamed or moved in the menu is searchable with no change here.
 * Matching is word by word, so "website setting" finds pages that match either
 * word, and pages that match both rank first. A short synonym list lets a
 * plain word like "website" find the pages that really handle it.
 */
import { flattenNav, pageDescriptions } from "@/lib/assistant/menu-knowledge";
import type { WorkspaceNavSection } from "@/lib/workspace-nav";

export type SearchEntry = {
  href: string;
  label: string;
  /** Menu trail for display, e.g. "Admin › Administration › Feature Controls". */
  path: string;
  labelText: string;
  labelWords: Set<string>;
  trailWords: Set<string>;
  descWords: Set<string>;
  descText: string;
};

export type MenuHit = {
  href: string;
  label: string;
  path: string;
  /** Why it matched, e.g. "matches site" or "related to website". */
  reason: string;
  /** Words to highlight in the label. */
  terms: string[];
  score: number;
};

const STOP = new Set(["the", "a", "an", "my", "to", "of", "for", "and", "in", "on", "where", "do", "i", "find", "how", "is", "can", "me", "open", "go", "show", "want"]);

/** Lowercase and drop a plural s, so "settings" and "setting" match. */
function stem(word: string): string {
  const w = word.toLowerCase();
  return w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
}

export function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(stem);
}

/** A plain word, then other words that pages handling it are likely to use. */
export const SEARCH_SYNONYMS: Record<string, string[]> = {
  website: ["site", "page", "builder", "aeo", "seo", "landing"],
  site: ["website", "page", "builder", "seo"],
  web: ["site", "page", "builder", "seo"],
  seo: ["aeo", "site", "page"],
  email: ["inbox", "mail", "message", "template", "sequence", "campaign"],
  mail: ["inbox", "email", "message"],
  billing: ["invoice", "pricing", "plan", "payment", "subscription", "account"],
  invoice: ["billing", "accounting", "payment"],
  price: ["pricing", "plan", "billing"],
  plan: ["pricing", "billing", "subscription"],
  limit: ["cap", "control", "feature", "allowance", "quota"],
  cap: ["limit", "control", "quota"],
  user: ["member", "people", "permission", "role", "account"],
  team: ["user", "member", "permission"],
  permission: ["role", "access", "user"],
  report: ["analytics", "insight", "dashboard"],
  chart: ["analytics", "report", "dashboard"],
  investor: ["fund", "directory", "crm", "relation"],
  contact: ["crm", "people", "lead", "connector", "sync"],
  lead: ["contact", "crm", "sale"],
  import: ["upload", "connector", "csv", "sync", "export"],
  export: ["import", "download", "csv"],
  meeting: ["calendar", "schedule", "meet"],
  calendar: ["meeting", "schedule"],
  task: ["todo", "action"],
  social: ["linkedin", "post", "media"],
  sign: ["signature", "esign", "document"],
  help: ["support", "manual", "guide"],
  setting: ["control", "config", "preference", "option", "feature"],
  config: ["setting", "control", "feature"],
  integration: ["connector", "sync", "google", "slack"],
  security: ["permission", "role", "audit"],
};

export function buildSearchIndex(
  sections: WorkspaceNavSection[],
  rootLabel: string,
  descriptions: Record<string, string> = pageDescriptions(),
): SearchEntry[] {
  return flattenNav(sections).map((leaf) => {
    const desc = descriptions[leaf.href] ?? "";
    return {
      href: leaf.href,
      label: leaf.label,
      path: [rootLabel, ...leaf.trail, leaf.label].join(" › "),
      labelText: leaf.label.toLowerCase(),
      labelWords: new Set(words(leaf.label)),
      trailWords: new Set(leaf.trail.flatMap(words)),
      descWords: new Set(words(desc)),
      descText: desc.toLowerCase(),
    };
  });
}

export function searchMenu(index: SearchEntry[], query: string, limit = 6): MenuHit[] {
  const tokens = [...new Set(words(query).filter((t) => !STOP.has(t)))];
  if (tokens.length === 0) return [];
  const hits: MenuHit[] = [];

  for (const e of index) {
    let score = 0;
    let covered = 0;
    const direct: string[] = [];
    const related: string[] = [];
    const terms = new Set<string>();

    for (const t of tokens) {
      let best = 0;
      let viaSynonym = false;
      if (e.labelWords.has(t)) best = 6;
      else if (e.labelText.includes(t)) best = 4;
      else if (e.trailWords.has(t)) best = 2.5;
      else if (e.descWords.has(t) || e.descText.includes(t)) best = 1.5;
      if (best > 0) {
        direct.push(t);
        if (e.labelText.includes(t)) terms.add(t);
      } else {
        for (const s of SEARCH_SYNONYMS[t] ?? []) {
          const w = stem(s);
          let b = 0;
          if (e.labelWords.has(w) || e.labelText.includes(w)) { b = 3; terms.add(w); }
          else if (e.trailWords.has(w) || e.descWords.has(w)) b = 1;
          if (b > best) { best = b; viaSynonym = true; }
        }
        if (best > 0 && viaSynonym) related.push(t);
      }
      if (best > 0) { covered += 1; score += best; }
    }
    if (covered === 0) continue;
    score += covered * 5;
    const parts: string[] = [];
    if (direct.length) parts.push(`matches ${direct.join(", ")}`);
    if (related.length) parts.push(`related to ${related.join(", ")}`);
    hits.push({ href: e.href, label: e.label, path: e.path, reason: parts.join(", "), terms: [...terms], score });
  }

  return hits
    .sort((a, b) => b.score - a.score || a.label.length - b.label.length)
    .slice(0, limit);
}
