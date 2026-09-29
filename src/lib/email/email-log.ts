/**
 * The platform's outbound email log (Admin, Activity, Sent).
 *
 * Every send path calls logOutboundEmail() once per send, whatever triggered it:
 * a scheduled job, a staff click, a founder or investor action. Each recipient
 * gets a row that says who they are (founder, investor, staff or external),
 * what triggered the email, and, once Resend reports back through the webhook,
 * whether it was delivered, opened, clicked, bounced or marked as spam.
 *
 * Best effort: a logging failure never affects the send itself.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { currentJob } from "@/lib/cron/job-context";

export const EMAIL_LOG_RETENTION_DAYS = 180;
const MAX_HTML = 100_000;
const MAX_TEXT = 20_000;

export type EmailRole = "founder" | "investor" | "staff" | "external";
export const EMAIL_ROLES: EmailRole[] = ["founder", "investor", "staff", "external"];

export type EmailLogInput = {
  to: string | string[] | null | undefined;
  subject: string;
  html?: string | null;
  text?: string | null;
  status: "sent" | "failed" | "skipped";
  error?: string | null;
  /** Resend's id for the send; delivery events are matched on it. */
  providerId?: string | null;
  /** What triggered the send, e.g. "ir-report", "marketplace-offering-live".
   *  Defaults to the scheduled job, else the route or page that ran it. */
  source?: string | null;
  /** Who the email is for when the recipient has no account (IR investors). */
  audience?: EmailRole | null;
  /** The signed-in person whose action sent it, when known. */
  triggeredBy?: string | null;
  /** Bulk marketing sends skip the body to keep the log small. */
  storeBody?: boolean;
};

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

function recipientsOf(value: EmailLogInput["to"]): string[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return [
    ...new Set(
      list
        .flatMap((v) => String(v).split(/[,;]/))
        .map((v) => v.trim().replace(/^.*<([^>]+)>.*$/, "$1").trim())
        .filter((v) => v.includes("@")),
    ),
  ];
}

/** Platform role to the log's four groups. Admin, analyst and anything else staff-side is staff. */
export function roleFor(dbRole: string | null | undefined): EmailRole {
  const r = String(dbRole ?? "").toLowerCase();
  if (r === "founder") return "founder";
  if (r === "investor") return "investor";
  return r ? "staff" : "external";
}

/**
 * The route or page that sent an email, read from the call stack, e.g.
 * "api/admin/ir/projects/[id]/report". Null when no app route is on the stack.
 */
export function sourceFromStack(stack: string | undefined): string | null {
  if (!stack) return null;
  const m = stack.match(/(?:server\/app|src\/app)\/(.+?)\/(route|page)\.(?:js|jsx|ts|tsx)/);
  if (!m) return null;
  const path = m[1].replace(/\([^)]*\)\//g, "").replace(/^\.\//, "");
  return m[2] === "page" ? `${path} (page)` : path;
}

function callerStack(): string | undefined {
  const prev = Error.stackTraceLimit;
  Error.stackTraceLimit = 60;
  const stack = new Error().stack;
  Error.stackTraceLimit = prev;
  return stack;
}

/**
 * The signed-in user behind the current request, read from the Supabase auth
 * cookie without a network call. Attribution only: the route already checked
 * access, and the id is confirmed against profiles before it is stored.
 * Null outside a request (scheduled jobs) or when nobody is signed in.
 */
export function userIdFromAuthCookies(cookies: Array<{ name: string; value: string }>): string | null {
  try {
    const parts = cookies
      .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
      .sort((a, b) => Number(a.name.split(".").pop()) - Number(b.name.split(".").pop()) || a.name.localeCompare(b.name));
    if (parts.length === 0) return null;
    let raw = parts.map((c) => c.value).join("");
    if (raw.startsWith("base64-")) raw = Buffer.from(raw.slice(7), "base64").toString("utf8");
    const parsed = JSON.parse(raw) as { access_token?: string } | string[];
    const token = Array.isArray(parsed) ? parsed[0] : parsed.access_token;
    if (!token) return null;
    const claims = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { sub?: unknown };
    return typeof claims.sub === "string" && /^[0-9a-f-]{36}$/i.test(claims.sub) ? claims.sub : null;
  } catch {
    return null;
  }
}

async function requestUserId(): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers");
    return userIdFromAuthCookies((await cookies()).getAll());
  } catch {
    return null;
  }
}

export async function logOutboundEmail(input: EmailLogInput): Promise<void> {
  try {
    const recipients = recipientsOf(input.to);
    if (recipients.length === 0) return;
    // A local run without email configured must not write into a shared database.
    if (input.status === "skipped" && process.env.NODE_ENV !== "production") return;

    const ctx = currentJob();
    const source = (input.source ?? (ctx ? `job:${ctx.job}` : sourceFromStack(callerStack())) ?? "app").slice(0, 200);
    const client = db();

    const lookup = [...new Set([...recipients, ...recipients.map((r) => r.toLowerCase())])];
    const { data: profiles } = await client.from("profiles").select("id, email, role").in("email", lookup);
    const byEmail = new Map(
      ((profiles ?? []) as Array<{ id: string; email: string | null; role: string | null }>).map((p) => [String(p.email).toLowerCase(), p]),
    );

    let triggeredBy = input.triggeredBy ?? (ctx ? null : await requestUserId());
    if (triggeredBy && triggeredBy !== input.triggeredBy) {
      const { data: who } = await client.from("profiles").select("id").eq("id", triggeredBy).maybeSingle();
      if (!who) triggeredBy = null;
    }

    const keepBody = input.storeBody !== false;
    const rows = recipients.map((to) => {
      const p = byEmail.get(to.toLowerCase());
      return {
        to_email: to,
        recipient_user_id: p?.id ?? null,
        recipient_role: p ? roleFor(p.role) : input.audience ?? "external",
        subject: input.subject.slice(0, 500),
        body_html: keepBody && input.html ? input.html.slice(0, MAX_HTML) : null,
        body_text: keepBody && input.text ? input.text.slice(0, MAX_TEXT) : null,
        source,
        job: ctx?.job ?? null,
        run_id: ctx?.runId ?? null,
        triggered_by: triggeredBy,
        status: input.status,
        error: input.error ? input.error.slice(0, 300) : null,
        provider_id: input.providerId ?? null,
      };
    });
    await client.from("email_log").insert(rows);

    if (Math.random() < 0.01) {
      await client
        .from("email_log")
        .delete()
        .lt("created_at", new Date(Date.now() - EMAIL_LOG_RETENTION_DAYS * 86_400_000).toISOString());
    }
  } catch {
    /* log only */
  }
}

// ---- Resend events ----

const EVENT_COLUMN: Record<string, string | undefined> = {
  "email.delivered": "delivered_at",
  "email.opened": "opened_at",
  "email.clicked": "clicked_at",
  "email.bounced": "bounced_at",
  "email.complained": "complained_at",
};

/** Attach a Resend webhook event to the logged send. Returns rows touched. */
export async function recordEmailLogEvent(input: { providerId: string; type: string; at?: string | null; to?: string[] }): Promise<number> {
  try {
    const client = db();
    const at = input.at && !Number.isNaN(Date.parse(input.at)) ? new Date(input.at).toISOString() : new Date().toISOString();
    const to = [...new Set([...(input.to ?? []), ...(input.to ?? []).map((t) => t.toLowerCase())])];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scope = (q: any) => {
      const base = q.eq("provider_id", input.providerId);
      return to.length ? base.in("to_email", to) : base;
    };
    const { data } = await scope(client.from("email_log").update({ last_event: input.type.replace(/^email\./, ""), last_event_at: at })).select("id");
    const col = EVENT_COLUMN[input.type];
    if (col) await scope(client.from("email_log").update({ [col]: at })).is(col, null);
    return (data ?? []).length;
  } catch {
    return 0;
  }
}

// ---- Reading (Admin, Activity, Sent) ----

export type EmailLogFilter = "all" | "failed" | "bounced" | "opened" | "unopened";

export type EmailLogItem = {
  id: number;
  createdAt: string;
  toEmail: string;
  recipientUserId: string | null;
  recipientName: string | null;
  recipientRole: EmailRole;
  subject: string;
  source: string;
  job: string | null;
  triggeredByName: string | null;
  status: "sent" | "failed" | "skipped";
  error: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
  complainedAt: string | null;
};

export type EmailLogDetail = EmailLogItem & { html: string | null; text: string | null; providerId: string | null };

type Row = {
  id: number;
  created_at: string;
  to_email: string;
  recipient_user_id: string | null;
  recipient_role: EmailRole;
  subject: string;
  source: string;
  job: string | null;
  triggered_by: string | null;
  status: "sent" | "failed" | "skipped";
  error: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  body_html?: string | null;
  body_text?: string | null;
  provider_id?: string | null;
};

const LIST_COLUMNS =
  "id, created_at, to_email, recipient_user_id, recipient_role, subject, source, job, triggered_by, status, error, delivered_at, opened_at, clicked_at, bounced_at, complained_at";

async function namesFor(client: SupabaseClient, rows: Row[]): Promise<Map<string, string>> {
  const ids = [...new Set(rows.flatMap((r) => [r.recipient_user_id, r.triggered_by]).filter((v): v is string => !!v))];
  if (ids.length === 0) return new Map();
  const { data } = await client.from("profiles").select("id, full_name, email").in("id", ids);
  return new Map(((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((p) => [p.id, p.full_name || p.email || "Unknown"]));
}

function toItem(r: Row, names: Map<string, string>): EmailLogItem {
  return {
    id: r.id,
    createdAt: r.created_at,
    toEmail: r.to_email,
    recipientUserId: r.recipient_user_id,
    recipientName: r.recipient_user_id ? names.get(r.recipient_user_id) ?? null : null,
    recipientRole: r.recipient_role,
    subject: r.subject,
    source: r.source,
    job: r.job,
    triggeredByName: r.triggered_by ? names.get(r.triggered_by) ?? null : null,
    status: r.status,
    error: r.error,
    deliveredAt: r.delivered_at,
    openedAt: r.opened_at,
    clickedAt: r.clicked_at,
    bouncedAt: r.bounced_at,
    complainedAt: r.complained_at,
  };
}

/** Postgrest or() filter text for a free-text search; commas and parens would break it. */
function searchClause(q: string): string | null {
  const clean = q.replace(/[,()*%\\]/g, " ").trim();
  if (!clean) return null;
  return `to_email.ilike.*${clean}*,subject.ilike.*${clean}*`;
}

export async function listEmailLog(opts: {
  role?: EmailRole | null;
  filter?: EmailLogFilter;
  q?: string | null;
  userId?: string | null;
  days?: number;
  before?: number | null;
  limit?: number;
}): Promise<{ items: EmailLogItem[]; counts: Record<EmailRole | "all", number>; nextBefore: number | null }> {
  const empty = { items: [], counts: { all: 0, founder: 0, investor: 0, staff: 0, external: 0 }, nextBefore: null };
  try {
    const client = db();
    const since = new Date(Date.now() - (opts.days ?? 30) * 86_400_000).toISOString();
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const narrow = (q: any, withRole: boolean) => {
      let x = q.gte("created_at", since);
      if (withRole && opts.role) x = x.eq("recipient_role", opts.role);
      if (opts.userId) x = x.eq("recipient_user_id", opts.userId);
      const s = opts.q ? searchClause(opts.q) : null;
      if (s) x = x.or(s);
      switch (opts.filter) {
        case "failed": x = x.eq("status", "failed"); break;
        case "bounced": x = x.not("bounced_at", "is", null); break;
        case "opened": x = x.not("opened_at", "is", null); break;
        case "unopened": x = x.eq("status", "sent").is("opened_at", null); break;
      }
      return x;
    };

    let list = narrow(client.from("email_log").select(LIST_COLUMNS), true).order("id", { ascending: false }).limit(limit + 1);
    if (opts.before) list = list.lt("id", opts.before);
    const { data, error } = await list;
    if (error || !data) return empty;

    const countOf = async (role: EmailRole | null) => {
      let q = narrow(client.from("email_log").select("id", { count: "exact", head: true }), false);
      if (role) q = q.eq("recipient_role", role);
      const { count } = await q;
      return count ?? 0;
    };
    const [all, founder, investor, staff, external] = await Promise.all([countOf(null), ...EMAIL_ROLES.map((r) => countOf(r))]);

    const rows = (data as Row[]).slice(0, limit);
    const names = await namesFor(client, rows);
    return {
      items: rows.map((r) => toItem(r, names)),
      counts: { all, founder, investor, staff, external },
      nextBefore: (data as Row[]).length > limit ? rows[rows.length - 1].id : null,
    };
  } catch {
    return empty;
  }
}

export async function getEmailLog(id: number): Promise<EmailLogDetail | null> {
  try {
    const client = db();
    const { data } = await client.from("email_log").select(`${LIST_COLUMNS}, body_html, body_text, provider_id`).eq("id", id).maybeSingle();
    if (!data) return null;
    const row = data as Row;
    const names = await namesFor(client, [row]);
    return { ...toItem(row, names), html: row.body_html ?? null, text: row.body_text ?? null, providerId: row.provider_id ?? null };
  } catch {
    return null;
  }
}
