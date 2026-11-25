// Reach goal vs actual: sent and opened counts across every founder company,
// for the Introductions and Automated outreach cards of the Reach tab.
//
// The rules are the Reach tab's own (src/lib/admin/investor-reach.ts), applied
// to all companies in a handful of queries:
//   Introductions      a request is sent when the first email to that investor
//                      went out after the request (bulk and automated sources
//                      excluded), and opened when one of those emails was opened.
//   Automated outreach a recipient is sent when the send has its email in
//                      email_log. A send logged in test mode reached no one and
//                      is not counted.
// Read only; service role, the caller authorizes first. A failed query throws,
// so a broken load is never shown as zero.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { logsFor, pickNearest, NON_INTRO_SOURCES } from "@/lib/admin/investor-reach";
import { buildActuals, reachWindowStart, type ReachActuals, type ReachEvent } from "@/lib/admin/reach-goals";

type Db = SupabaseClient;
type LogRow = Parameters<typeof logsFor>[0][number];
type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

const PAGE = 1000;
const MAX_PAGES = 50;
const LOG_COLS = "id, to_email, source, created_at, status, delivered_at, opened_at, clicked_at, bounced_at";
/** An automated send from up to this long before the window can still be opened inside it. */
const OPEN_LOOKBACK_MS = 30 * 86_400_000;

const lc = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const uniq = (vals: Array<string | null | undefined>) => [...new Set(vals.filter((v): v is string => Boolean(v)))];
const earliest = (vals: Array<string | null | undefined>) => vals.filter((v): v is string => Boolean(v)).sort()[0] ?? null;

/** Every row of a query, read a page at a time (the API returns at most 1,000 rows per request). */
async function all<T>(what: string, page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await page(i * PAGE, i * PAGE + PAGE - 1);
    if (error) throw new Error(`Could not load ${what}: ${error.message}`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return rows;
  }
  throw new Error(`Could not load ${what}: more than ${MAX_PAGES * PAGE} rows.`);
}

/** Rows whose `column` is one of `ids`, in chunks small enough for one request. */
async function byIds<T>(client: Db, table: string, cols: string, column: string, ids: string[], size = 200): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += size) {
    const chunk = ids.slice(i, i + size);
    rows.push(...(await all<T>(table, (from, to) => client.from(table).select(cols).in(column, chunk).order(column).range(from, to) as unknown as Page<T>)));
  }
  return rows;
}

function groupByAddress(logs: LogRow[]): Map<string, LogRow[]> {
  const out = new Map<string, LogRow[]>();
  for (const l of logs) {
    if (l.status === "skipped") continue;
    const key = lc(l.to_email);
    const list = out.get(key);
    if (list) list.push(l);
    else out.set(key, [l]);
  }
  return out;
}

async function introEvents(client: Db): Promise<ReachEvent[]> {
  type Pir = { id: string; investor_ref: string; created_at: string };
  type Ir = { id: string; investor_id: string | null; pipeline_investor_id: string | null; created_at: string };
  const [pirs, irs] = await Promise.all([
    all<Pir>("introduction requests", (from, to) =>
      client.from("prospect_intro_requests").select("id, investor_ref, created_at").neq("status", "dismissed").order("created_at").order("id").range(from, to) as unknown as Page<Pir>,
    ),
    all<Ir>("introduction requests", (from, to) =>
      client.from("intro_requests").select("id, investor_id, pipeline_investor_id, created_at").neq("status", "declined").order("created_at").order("id").range(from, to) as unknown as Page<Ir>,
    ),
  ]);

  // Who each request is for, as an email address.
  const prospectIds = uniq(pirs.map((p) => (p.investor_ref.startsWith("prospect:") ? p.investor_ref.slice(9) : null)));
  const prospects = await byIds<{ id: string; source_ref: string | null }>(client, "prospect_investors", "id, source_ref", "id", prospectIds);
  const contactOfProspect = new Map(prospects.filter((p) => p.source_ref).map((p) => [p.id, p.source_ref as string]));
  const [contacts, profiles, pipeline] = await Promise.all([
    byIds<{ id: string; email: string | null }>(client, "crm_contacts", "id, email", "id", uniq([...contactOfProspect.values()])),
    byIds<{ id: string; email: string | null }>(client, "profiles", "id, email", "id", uniq(irs.map((r) => r.investor_id))),
    byIds<{ id: string; contact_email: string | null }>(client, "pipeline_investors", "id, contact_email", "id", uniq(irs.map((r) => r.pipeline_investor_id))),
  ]);
  const contactEmail = new Map(contacts.map((c) => [c.id, c.email]));
  const profileEmail = new Map(profiles.map((p) => [p.id, p.email]));
  const pipelineEmail = new Map(pipeline.map((p) => [p.id, p.contact_email]));

  const requests: Array<{ email: string | null; at: string }> = [
    ...pirs.map((p) => {
      const pid = p.investor_ref.startsWith("prospect:") ? p.investor_ref.slice(9) : null;
      const cid = pid ? contactOfProspect.get(pid) : undefined;
      return { email: cid ? contactEmail.get(cid) ?? null : null, at: p.created_at };
    }),
    ...irs.map((r) => ({
      email: (r.investor_id ? profileEmail.get(r.investor_id) : null) ?? (r.pipeline_investor_id ? pipelineEmail.get(r.pipeline_investor_id) : null) ?? null,
      at: r.created_at,
    })),
  ];

  // Every email to those investors since the first request: the first one after a request is its send.
  const since = earliest(requests.map((r) => r.at));
  const addresses = uniq(requests.flatMap((r) => (r.email ? [r.email.trim(), lc(r.email)] : [])));
  const logs: LogRow[] = [];
  for (let i = 0; i < addresses.length; i += 150) {
    const chunk = addresses.slice(i, i + 150);
    logs.push(
      ...(await all<LogRow>("the email log", (from, to) => {
        let q = client.from("email_log").select(LOG_COLS).in("to_email", chunk);
        if (since) q = q.gte("created_at", since);
        return q.order("created_at").order("id").range(from, to) as unknown as Page<LogRow>;
      })),
    );
  }
  const byAddress = groupByAddress(logs);
  const introMail = (l: LogRow) => !NON_INTRO_SOURCES.has(l.source ?? "");

  return requests.map((r) => {
    const ls = logsFor(byAddress.get(lc(r.email)) ?? [], r.email, r.at, introMail);
    return { sentAt: ls[0]?.created_at ?? null, openedAt: earliest(ls.map((l) => l.opened_at)) };
  });
}

async function autoEvents(client: Db, windowStart: string): Promise<ReachEvent[]> {
  type Ior = { id: string; investor_ref: string; sent_at: string | null; opened_at: string | null; email: string | null };
  const from0 = new Date(Date.parse(windowStart) - OPEN_LOOKBACK_MS).toISOString();
  const [recipients, logs] = await Promise.all([
    all<Ior>("automated outreach", (from, to) =>
      client.from("investor_outreach_recipients").select("id, investor_ref, sent_at, opened_at, email").eq("status", "sent").gte("sent_at", from0).order("sent_at").order("id").range(from, to) as unknown as Page<Ior>,
    ),
    all<LogRow>("the email log", (from, to) =>
      client
        .from("email_log")
        .select(LOG_COLS)
        .eq("source", "investor-intro")
        // pickNearest matches a send to its email within 30 minutes either side.
        .gte("created_at", new Date(Date.parse(from0) - 3_600_000).toISOString())
        .order("created_at")
        .order("id")
        .range(from, to) as unknown as Page<LogRow>,
    ),
  ]);
  const contacts = await byIds<{ id: string; email: string | null }>(client, "crm_contacts", "id, email", "id", uniq(recipients.filter((r) => !r.email).map((r) => r.investor_ref)));
  const contactEmail = new Map(contacts.map((c) => [c.id, c.email]));
  const byAddress = groupByAddress(logs);

  const events: ReachEvent[] = [];
  for (const r of recipients) {
    const email = r.email ?? contactEmail.get(r.investor_ref) ?? null;
    const l = pickNearest(byAddress.get(lc(email)) ?? [], email, "investor-intro", r.sent_at);
    // No email in the log: logged as sent in test mode, nothing reached the investor.
    if (!l) continue;
    events.push({ sentAt: r.sent_at, openedAt: l.opened_at ?? r.opened_at });
  }
  return events;
}

/** Sent and opened, per PT week and month, for Introductions and Automated outreach across all companies. */
export async function loadReachActuals(now: Date = new Date()): Promise<ReachActuals> {
  const client = createServiceRoleClient() as unknown as Db;
  const [intro, auto] = await Promise.all([introEvents(client), autoEvents(client, reachWindowStart(now))]);
  return buildActuals({ intro, auto }, now);
}
