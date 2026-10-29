// Notes log: every communication on an admin CRM contact, in one timeline.
// Writes go to sales_activity_log (no new table). Each auto-logged row carries
// meta.external_id so a write, or the backfill, is safe to run twice: the unique
// index sales_activity_log_external_uq turns the second insert into a no-op.
// Admin only. Nothing here is used by founder pages.
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isNoteKind } from "@/lib/sales/chatter-merge";
import { safeInternalHref } from "@/lib/sales/proposal-activity";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

// ---------------------------------------------------------------- kinds and chips

/** Kinds written by logCommunication. Notes and system kinds keep their own writers. */
export type CommunicationKind = "email" | "message" | "call" | "marketing" | "sequence";

export const NOTES_LOG_CHIPS = ["all", "notes", "email", "messages", "calls", "sequences", "marketing"] as const;
export type NotesLogChip = (typeof NOTES_LOG_CHIPS)[number];

/** Kinds behind each chip. "all" also shows the system kinds (contact_edit, task_created, ...). */
export const CHIP_KINDS: Record<Exclude<NotesLogChip, "all">, readonly string[]> = {
  notes: ["note", "opp_note", "odoo_note"],
  email: ["email"],
  messages: ["message", "odoo_message"],
  calls: ["call"],
  sequences: ["sequence"],
  marketing: ["marketing"],
};

export function isNotesLogChip(v: unknown): v is NotesLogChip {
  return typeof v === "string" && (NOTES_LOG_CHIPS as readonly string[]).includes(v);
}

/** The chip a kind is counted under, or null for a system kind (shown under All only). */
export function chipOf(kind: string): Exclude<NotesLogChip, "all"> | null {
  for (const [chip, kinds] of Object.entries(CHIP_KINDS)) {
    if (kinds.includes(kind)) return chip as Exclude<NotesLogChip, "all">;
  }
  return null;
}

const AUTO_KINDS = new Set<string>(["email", "message", "call", "sequence", "marketing", "odoo_message"]);

export type NotesLogTag = "auto" | "inbound" | "marketing";

/** Marketing for a campaign send, Inbound for anything received, Auto for any other logged communication. */
export function tagOf(kind: string, meta: NotesLogMeta | null): NotesLogTag | null {
  if (kind === "marketing") return "marketing";
  if (meta?.direction === "inbound") return "inbound";
  return AUTO_KINDS.has(kind) ? "auto" : null;
}

// ---------------------------------------------------------------- meta

export type CallOutcome = "answered" | "no_answer" | "voicemail" | "busy";

/** meta keys by kind (spec Section 4). All optional; add only what applies. */
export type NotesLogMeta = {
  via?: "gmail" | "icapos";
  direction?: "outbound" | "inbound";
  to?: string;
  subject?: string;
  preview?: string;
  campaign_id?: string;
  campaign_name?: string;
  sequence_id?: string;
  step?: number;
  email_log_id?: string;
  phone?: string;
  duration_seconds?: number;
  outcome?: CallOutcome;
  recording_url?: string;
  call_attempt_id?: string;
  /** Gmail message id, email_log.id, call_attempts.id: the idempotency key. */
  external_id?: string;
  href?: string;
};

const META_KEYS = [
  "via", "direction", "to", "subject", "preview", "campaign_id", "campaign_name", "sequence_id", "step",
  "email_log_id", "phone", "duration_seconds", "outcome", "recording_url", "call_attempt_id", "external_id", "href",
] as const satisfies ReadonlyArray<keyof NotesLogMeta>;

/** Keep only the known meta keys, drop empties. Unknown keys from older writers are ignored. */
export function pickMeta(raw: unknown): NotesLogMeta {
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== "object") return out;
  const src = raw as Record<string, unknown>;
  for (const k of META_KEYS) {
    const v = src[k];
    if (v === undefined || v === null || v === "") continue;
    if (k === "step" || k === "duration_seconds") {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    } else {
      out[k] = String(v);
    }
  }
  // Older call rows store `duration` (seconds) instead of duration_seconds.
  if (out.duration_seconds === undefined && src.duration != null && Number.isFinite(Number(src.duration))) {
    out.duration_seconds = Number(src.duration);
  }
  return out as NotesLogMeta;
}

// ---------------------------------------------------------------- preview and dates

export const PREVIEW_LENGTH = 280;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };

/** First 280 characters of a body as plain text. Accepts HTML or plain text. */
export function buildPreview(body: string | null | undefined, max = PREVIEW_LENGTH): string {
  if (!body) return "";
  const text = body
    .replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6])>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : " ";
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max).trimEnd() : text;
}

const PT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short", day: "numeric", year: "numeric",
  hour: "numeric", minute: "2-digit",
});

/** "Oct 29, 2026, 2:41 AM PT". Always the year, always Pacific time. */
export function formatPT(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${PT.format(d).replace(/[  ]/g, " ")} PT`;
}

/** Start of the "last 12 months" window. Older entries sit behind Show more. */
export function oneYearBefore(now: Date): Date {
  const d = new Date(now.getTime());
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d;
}

// ---------------------------------------------------------------- writes

export type CommunicationInput = {
  kind: CommunicationKind;
  /** The one line shown as the title, e.g. "Email sent: subject". */
  summary: string;
  contactCrmId: string;
  opportunityId?: string | null;
  actorId?: string | null;
  /** When it really happened. Defaults to now. Backfills pass the original time. */
  occurredAt?: string | Date | null;
  meta?: NotesLogMeta;
};

export type InsertRow = {
  kind: string;
  summary: string;
  contact_crm_id: string;
  opportunity_id: string | null;
  actor_id: string | null;
  meta: NotesLogMeta | null;
  created_at?: string;
};

/** The sales_activity_log row for one communication. Pure. */
export function toInsertRow(input: CommunicationInput): InsertRow {
  const meta = pickMeta(input.meta ?? {});
  if (meta.preview) meta.preview = buildPreview(meta.preview);
  if (meta.subject) meta.subject = meta.subject.slice(0, 300);
  const row: InsertRow = {
    kind: input.kind,
    summary: input.summary.trim().slice(0, 2000),
    contact_crm_id: input.contactCrmId,
    opportunity_id: input.opportunityId ?? null,
    actor_id: input.actorId ?? null,
    meta: Object.keys(meta).length > 0 ? meta : null,
  };
  if (input.occurredAt) {
    const d = input.occurredAt instanceof Date ? input.occurredAt : new Date(input.occurredAt);
    if (!Number.isNaN(d.getTime())) row.created_at = d.toISOString();
  }
  return row;
}

const UNIQUE_VIOLATION = "23505";

export type LogResult = "logged" | "duplicate" | "failed";

/**
 * Log one communication on a contact. Call it after the provider accepted the send.
 * Never throws and never blocks the send: a failure goes to the server log.
 * A second write with the same external_id is a no-op ("duplicate").
 */
export async function logCommunication(input: CommunicationInput): Promise<LogResult> {
  try {
    if (!input.contactCrmId || !input.summary.trim()) return "failed";
    const { error } = await db().from("sales_activity_log").insert(toInsertRow(input));
    if (!error) return "logged";
    if (error.code === UNIQUE_VIOLATION) return "duplicate";
    console.error("[notes-log] logCommunication failed", { kind: input.kind, contactCrmId: input.contactCrmId, error: error.message });
    return "failed";
  } catch (err) {
    console.error("[notes-log] logCommunication threw", { kind: input.kind, contactCrmId: input.contactCrmId, error: err instanceof Error ? err.message : String(err) });
    return "failed";
  }
}

export const BATCH_SIZE = 500;

/**
 * Log many communications (a Marketing campaign, the backfill) in batches of 500.
 * A batch that hits an already logged row is retried row by row so the rest still land.
 * Never throws.
 */
export async function logCommunicationBatch(inputs: CommunicationInput[]): Promise<Record<LogResult, number>> {
  const counts: Record<LogResult, number> = { logged: 0, duplicate: 0, failed: 0 };
  const valid = inputs.filter((i) => i.contactCrmId && i.summary.trim());
  counts.failed += inputs.length - valid.length;
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const chunk = valid.slice(i, i + BATCH_SIZE);
    try {
      const { error } = await db().from("sales_activity_log").insert(chunk.map(toInsertRow));
      if (!error) { counts.logged += chunk.length; continue; }
      if (error.code !== UNIQUE_VIOLATION) {
        console.error("[notes-log] batch insert failed", { size: chunk.length, error: error.message });
        counts.failed += chunk.length;
        continue;
      }
    } catch (err) {
      console.error("[notes-log] batch insert threw", { size: chunk.length, error: err instanceof Error ? err.message : String(err) });
      counts.failed += chunk.length;
      continue;
    }
    for (const one of chunk) counts[await logCommunication(one)] += 1;
  }
  return counts;
}

// ---------------------------------------------------------------- reads

export type NotesLogEntry = {
  id: string;
  kind: string;
  chip: Exclude<NotesLogChip, "all"> | null;
  tag: NotesLogTag | null;
  summary: string;
  actor_name: string | null;
  created_at: string;
  /** "Oct 29, 2026, 2:41 AM PT" */
  created_at_pt: string;
  edited_at: string | null;
  /** Only manual notes can be edited or deleted. Auto entries never. */
  editable: boolean;
  meta: NotesLogMeta;
};

export type ChipCounts = Record<NotesLogChip, number>;
export type NotesLogCounts = { recent: ChipCounts; older: ChipCounts };

function emptyCounts(): ChipCounts {
  return { all: 0, notes: 0, email: 0, messages: 0, calls: 0, sequences: 0, marketing: 0 };
}

/** Per chip counts, split at the 12 month cutoff. Pure. */
export function groupCounts(rows: Array<{ kind: string; created_at: string }>, cutoff: Date): NotesLogCounts {
  const out: NotesLogCounts = { recent: emptyCounts(), older: emptyCounts() };
  const cut = cutoff.getTime();
  for (const r of rows) {
    const bucket = new Date(r.created_at).getTime() >= cut ? out.recent : out.older;
    bucket.all += 1;
    const chip = chipOf(r.kind);
    if (chip) bucket[chip] += 1;
  }
  return out;
}

export function rowToEntry(r: Record<string, unknown>): NotesLogEntry {
  const a = r.actor as { full_name?: string | null; email?: string | null } | null;
  const kind = String(r.kind);
  const meta = pickMeta(r.meta);
  if (meta.href) {
    const safe = safeInternalHref(meta.href);
    if (safe) meta.href = safe; else delete meta.href;
  }
  if (meta.recording_url && !/^https:\/\//i.test(meta.recording_url)) delete meta.recording_url;
  const created = String(r.created_at);
  return {
    id: String(r.id),
    kind,
    chip: chipOf(kind),
    tag: tagOf(kind, meta),
    summary: String(r.summary ?? ""),
    actor_name: a?.full_name ?? a?.email ?? null,
    created_at: created,
    created_at_pt: formatPT(created),
    edited_at: (r.edited_at as string | null) ?? null,
    editable: isNoteKind(kind),
    meta,
  };
}

const ENTRY_COLS = "id, kind, summary, created_at, edited_at, meta, actor:profiles!sales_activity_log_actor_id_fkey(full_name, email)";
export const PAGE_SIZE = 50;
const COUNT_CAP = 20000;

export type NotesLogPage = {
  entries: NotesLogEntry[];
  hasMore: boolean;
  /** ISO start of the 12 month window. Pass it as `before` to load the older entries. */
  cutoff: string;
  /** Only on the first page (no `before`). */
  counts: NotesLogCounts | null;
};

/**
 * One page of a contact's Notes log, newest first.
 *  - No `before`: the last 12 months, plus the per chip counts.
 *  - `before` inside the 12 months: the next page of the last 12 months (Load more).
 *  - `before` at or before the cutoff: older than 1 year (Show more, and its Load more).
 */
export async function listNotesLog(
  contactCrmId: string,
  opts: { chip?: NotesLogChip; before?: string | null; now?: Date; limit?: number } = {},
): Promise<NotesLogPage> {
  const cutoff = oneYearBefore(opts.now ?? new Date());
  const cutoffIso = cutoff.toISOString();
  const limit = Math.min(Math.max(opts.limit ?? PAGE_SIZE, 1), 200);
  const before = opts.before ? new Date(opts.before) : null;
  if (before && Number.isNaN(before.getTime())) throw new Error("Invalid before.");
  const chip = opts.chip ?? "all";

  let q = db().from("sales_activity_log").select(ENTRY_COLS).eq("contact_crm_id", contactCrmId).is("deleted_at", null);
  if (chip !== "all") q = q.in("kind", [...CHIP_KINDS[chip]]);
  if (before) q = q.lt("created_at", before.toISOString());
  if (!before || before.getTime() > cutoff.getTime()) q = q.gte("created_at", cutoffIso);
  q = q.order("created_at", { ascending: false }).limit(limit + 1);

  const countsQuery = before
    ? Promise.resolve(null)
    : db().from("sales_activity_log").select("kind, created_at").eq("contact_crm_id", contactCrmId).is("deleted_at", null).limit(COUNT_CAP);

  const [list, countRows] = await Promise.all([q, countsQuery]);
  if (list.error) throw new Error(`Notes log: ${list.error.message}`);
  if (countRows?.error) throw new Error(`Notes log counts: ${countRows.error.message}`);

  const raw = (list.data ?? []) as Array<Record<string, unknown>>;
  return {
    entries: raw.slice(0, limit).map(rowToEntry),
    hasMore: raw.length > limit,
    cutoff: cutoffIso,
    counts: countRows ? groupCounts((countRows.data ?? []) as Array<{ kind: string; created_at: string }>, cutoff) : null,
  };
}
