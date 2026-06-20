import { ADMIN_SOPS } from "./library";
import type { SopEntry, SopViewer, SopVisibility } from "./types";

/**
 * Pure retrieval + gating for the Admin Operations Manual. No I/O — all inputs
 * are passed in, so this is fully unit-testable.
 */

const STOP_WORDS = new Set([
  "the", "a", "an", "to", "of", "for", "and", "or", "is", "are", "do", "does",
  "how", "i", "we", "you", "can", "what", "whats", "where", "when", "my", "me",
  "please", "with", "in", "on", "this", "that", "it", "be", "as", "from", "by",
  "process", "steps", "step", "guide", "sop", "procedure", "way",
]);

/** Phrases that signal the admin is asking how to do something. */
const HOWTO_PATTERNS = [
  /\bhow (do|can|to|would)\b/,
  /\bwhat'?s the (process|procedure|steps?|way)\b/,
  /\bsteps? (to|for)\b/,
  /\bguide (to|for|me)\b/,
  /\bwalk me through\b/,
  /\bwhere do i\b/,
  /\bprocedure for\b/,
  /\b(sop|runbook|manual)\b/,
  /\bhelp me (create|delete|deactivate|invite|onboard|set up|setup|change|reset|approve|deploy)\b/,
];

/** Admin operation verbs that, combined with a how-ish framing, indicate a SOP query. */
const OP_VERB_PATTERN =
  /\b(onboard|create|invite|add|edit|change|update|deactivate|reactivate|disable|enable|delete|remove|purge|reset|revoke|assign|grant|approve|reject|publish|deploy|roll ?back|rotate|back ?up|restore|export|import|escalate|offboard|provision)\b/;

const NOUN_HINT_PATTERN =
  /\b(user|users|account|accounts|admin|analyst|staff|role|roles|permission|permissions|investor|founder|spv|campaign|plan|subscription|password|session|secret|key|migration|backup|sequence|report|diligence|compliance|score)\b/;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * True if the message reads like a "how do I…" admin operations question.
 * Conservative: requires either an explicit how-to phrase, or an operation verb
 * paired with an admin noun (e.g. "delete a user").
 */
export function isAdminSopIntent(message: string): boolean {
  const lower = message.toLowerCase();
  if (HOWTO_PATTERNS.some((re) => re.test(lower))) return true;
  return OP_VERB_PATTERN.test(lower) && NOUN_HINT_PATTERN.test(lower);
}

/** Resolve one SOP's visibility for a viewer (hidden / locked / open). */
export function resolveVisibility(sop: SopEntry, viewer: SopViewer): SopVisibility {
  if (sop.superAdminOnly && !viewer.isSuperAdmin) {
    return { visible: false, locked: true };
  }
  if (sop.permission && !viewer.isSuperAdmin && !viewer.permissions.includes(sop.permission)) {
    return { visible: true, locked: true };
  }
  return { visible: true, locked: false };
}

/** Entries the viewer is allowed to see, each tagged with whether it's locked. */
export function visibleSops(
  viewer: SopViewer,
  entries: SopEntry[] = ADMIN_SOPS,
): Array<{ sop: SopEntry; locked: boolean }> {
  const out: Array<{ sop: SopEntry; locked: boolean }> = [];
  for (const sop of entries) {
    const v = resolveVisibility(sop, viewer);
    if (v.visible) out.push({ sop, locked: v.locked });
  }
  return out;
}

function scoreSop(queryTokens: string[], sop: SopEntry): number {
  if (queryTokens.length === 0) return 0;
  const titleTokens = new Set(tokenize(sop.title));
  const keywordSet = new Set(sop.keywords.map((k) => k.toLowerCase()));
  const keywordTokens = new Set(sop.keywords.flatMap((k) => tokenize(k)));
  const summaryTokens = new Set(tokenize(sop.summary));
  const lowerQuery = queryTokens.join(" ");

  let score = 0;
  // Whole multi-word keyword phrase present in the query is the strongest signal.
  for (const kw of keywordSet) {
    if (kw.includes(" ") && lowerQuery.includes(kw)) score += 5;
  }
  for (const t of queryTokens) {
    if (titleTokens.has(t)) score += 3;
    if (keywordTokens.has(t)) score += 2;
    if (summaryTokens.has(t)) score += 1;
  }
  return score;
}

/**
 * Rank SOPs by lexical relevance to the message, restricted to entries the
 * viewer may see. Returns highest-scoring first; entries scoring 0 are dropped.
 */
export function retrieveSops(
  message: string,
  viewer: SopViewer,
  options: { limit?: number; entries?: SopEntry[] } = {},
): Array<{ sop: SopEntry; locked: boolean; score: number }> {
  const { limit = 3, entries = ADMIN_SOPS } = options;
  const queryTokens = tokenize(message);
  const pool = visibleSops(viewer, entries);

  return pool
    .map(({ sop, locked }) => ({ sop, locked, score: scoreSop(queryTokens, sop) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.sop.id - b.sop.id)
    .slice(0, limit);
}
