import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { mapStatus, variantToPlan } from "@/lib/billing/webhook-mapping";

export const dynamic = "force-dynamic";

/**
 * GET /api/billing/repair — staff (admin) only. Fixes the two things that stop
 * payments from reaching iCapOS, using the Lemon Squeezy API key already in the
 * environment, so nobody has to edit the Lemon Squeezy dashboard by hand.
 *
 *   /api/billing/repair           report only, changes nothing
 *   /api/billing/repair?apply=1   apply the fixes below
 *
 * 1. Webhook: every live-mode webhook pointing at /api/billing/webhook gets the
 *    signing secret in LEMONSQUEEZY_WEBHOOK_SECRET (one is created if none
 *    exists), so notifications stop failing with 401.
 * 2. Subscriptions: live Lemon Squeezy subscriptions are matched to iCapOS
 *    accounts by email and linked (ids, status, plan, renewal date), the same
 *    fields the webhook writes. Accounts already linked are left alone.
 */

const LS_API = "https://api.lemonsqueezy.com/v1";
const WEBHOOK_PATH = "/api/billing/webhook";
const EVENTS = [
  "order_created",
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_resumed",
  "subscription_expired",
  "subscription_paused",
  "subscription_unpaused",
  "subscription_payment_success",
  "subscription_payment_failed",
  "subscription_payment_recovered",
];

type LsItem<A> = { id: string; attributes: A };
type WebhookAttrs = { url: string; events: string[]; test_mode: boolean; last_sent_at: string | null };
type SubAttrs = {
  user_email: string;
  status: string;
  variant_id: number;
  variant_name?: string | null;
  product_name?: string | null;
  customer_id: number;
  renews_at: string | null;
  ends_at: string | null;
  test_mode: boolean;
};

function headers() {
  return {
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
    Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
  };
}

async function ls<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: T | null; text: string }> {
  const res = await fetch(`${LS_API}${path}`, { ...init, headers: headers(), cache: "no-store" });
  const text = await res.text();
  let json: T | null = null;
  try { json = JSON.parse(text) as T; } catch { /* keep text */ }
  return { ok: res.ok, status: res.status, json, text: text.slice(0, 300) };
}

async function listAll<A>(path: string): Promise<LsItem<A>[]> {
  const out: LsItem<A>[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const sep = path.includes("?") ? "&" : "?";
    const r = await ls<{ data: LsItem<A>[]; meta?: { page?: { lastPage?: number } } }>(`${path}${sep}page[number]=${page}&page[size]=100`);
    if (!r.ok || !r.json) break;
    out.push(...r.json.data);
    const last = r.json.meta?.page?.lastPage ?? page;
    if (page >= last) break;
  }
  return out;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireStaffApi(["admin"]);
  if ("error" in auth) return auth.error as NextResponse;

  const apply = req.nextUrl.searchParams.get("apply") === "1";
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim();
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://icapos.com").replace(/\/+$/, "");
  const report: Record<string, unknown> = { mode: apply ? "applied" : "report only (add ?apply=1 to fix)" };

  if (!process.env.LEMONSQUEEZY_API_KEY) return NextResponse.json({ ...report, error: "LEMONSQUEEZY_API_KEY is not set." }, { status: 400 });
  if (!secret) return NextResponse.json({ ...report, error: "LEMONSQUEEZY_WEBHOOK_SECRET is not set." }, { status: 400 });

  // Store for this API key.
  const stores = await ls<{ data: LsItem<{ name: string }>[] }>("/stores");
  if (!stores.ok || !stores.json?.data?.length) {
    return NextResponse.json({ ...report, error: `Lemon Squeezy API key rejected (HTTP ${stores.status}).`, detail: stores.text }, { status: 502 });
  }
  const storeId = process.env.LEMONSQUEEZY_STORE_ID?.trim() || stores.json.data[0].id;
  report.store = { id: storeId, name: stores.json.data.find((s) => s.id === storeId)?.attributes.name ?? null };

  /* 1. Webhook secret */
  const hooks = await listAll<WebhookAttrs>(`/webhooks?filter[store_id]=${storeId}`);
  const ours = hooks.filter((h) => h.attributes.url.includes(WEBHOOK_PATH));
  const live = ours.filter((h) => !h.attributes.test_mode);
  const webhookResults: unknown[] = [];
  if (apply) {
    for (const h of live) {
      const r = await ls(`/webhooks/${h.id}`, {
        method: "PATCH",
        body: JSON.stringify({ data: { type: "webhooks", id: h.id, attributes: { secret } } }),
      });
      webhookResults.push({ id: h.id, url: h.attributes.url, updated: r.ok, status: r.status, ...(r.ok ? {} : { detail: r.text }) });
    }
    if (live.length === 0) {
      const r = await ls("/webhooks", {
        method: "POST",
        body: JSON.stringify({
          data: {
            type: "webhooks",
            attributes: { url: `${site}${WEBHOOK_PATH}`, events: EVENTS, secret },
            relationships: { store: { data: { type: "stores", id: storeId } } },
          },
        }),
      });
      webhookResults.push({ created: r.ok, url: `${site}${WEBHOOK_PATH}`, status: r.status, ...(r.ok ? {} : { detail: r.text }) });
    }
  }
  report.webhooks = {
    found: ours.map((h) => ({ id: h.id, url: h.attributes.url, test_mode: h.attributes.test_mode, last_sent_at: h.attributes.last_sent_at })),
    live_count: live.length,
    ...(apply ? { results: webhookResults } : { would: live.length ? `set the secret on ${live.length} live webhook(s)` : "create one live webhook" }),
  };

  /* 2. Link subscriptions by email */
  const subs = (await listAll<SubAttrs>(`/subscriptions?filter[store_id]=${storeId}`)).filter((s) => !s.attributes.test_mode);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any;
  const linked: unknown[] = [];
  const unmatched: unknown[] = [];
  const already: unknown[] = [];
  for (const s of subs) {
    const a = s.attributes;
    const email = a.user_email?.trim().toLowerCase();
    const { data: profile } = await admin.from("profiles").select("id").ilike("email", email ?? "").maybeSingle();
    if (!profile) { unmatched.push({ ls_subscription_id: s.id, email, status: a.status }); continue; }
    const { data: row } = await admin.from("subscriptions").select("id, ls_subscription_id").eq("profile_id", profile.id).maybeSingle();
    if (row?.ls_subscription_id === s.id) { already.push({ email, ls_subscription_id: s.id }); continue; }
    const { plan } = variantToPlan(a.variant_id, a.variant_name, a.product_name);
    const mapped = mapStatus(a.status);
    const patch = {
      ls_subscription_id: s.id,
      ls_customer_id: String(a.customer_id),
      ls_variant_id: String(a.variant_id),
      ...(mapped.unknown ? {} : { subscription_status: mapped.status, grace_period_ends_at: mapped.gracePeriodEndsAt }),
      ...(plan ? { plan_type: plan } : {}),
      current_period_end: a.renews_at ?? a.ends_at ?? null,
      updated_at: new Date().toISOString(),
    };
    if (!apply) { linked.push({ email, ls_subscription_id: s.id, status: a.status, plan, would: row ? "link existing account" : "no subscription row yet, skipped" }); continue; }
    if (!row) { unmatched.push({ email, ls_subscription_id: s.id, reason: "account has no subscription row" }); continue; }
    const { error } = await admin.from("subscriptions").update(patch).eq("id", row.id);
    linked.push({ email, ls_subscription_id: s.id, status: a.status, plan, linked: !error, ...(error ? { error: error.message } : {}) });
  }
  report.subscriptions = { live_in_lemon_squeezy: subs.length, [apply ? "linked" : "to_link"]: linked, already_linked: already, unmatched };

  return NextResponse.json(report);
}
