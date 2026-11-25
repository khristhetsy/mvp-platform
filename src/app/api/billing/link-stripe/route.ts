import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { recordOperationalEvent } from "@/lib/monitoring/operational-events";
import {
  matchStripeLinks,
  parseStripeLinkInputs,
  stripeLinksToWrite,
  type StripeLinkInput,
  type StripeLinkOutcome,
  type StripeLinkRow,
} from "@/lib/billing/stripe-link-core";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/link-stripe — staff (admin) only, one off.
 *
 * Links Stripe subscriptions that were created outside our checkout (Lemon Squeezy's
 * migration tool) to the iCapOS subscriptions row they belong to. Such a subscription
 * carries no profile_id in its metadata, so the Stripe webhook cannot place it and
 * answers "no target". Once its ids are on the row, the webhook finds the row through
 * its own stripe_subscription_id lookup.
 *
 *   POST /api/billing/link-stripe           report only, changes nothing
 *   POST /api/billing/link-stripe?apply=1   write the Stripe ids on matched rows
 *
 * Body: a JSON list (or `{ "rows": [...] }`) of
 *   { "ls_subscription_id": "...", "stripe_subscription_id": "sub_...", "stripe_customer_id": "cus_..." }
 *
 * Each row is matched on subscriptions.ls_subscription_id, which is unique. Apply writes
 * stripe_subscription_id and stripe_customer_id on that row and nothing else:
 * - the Lemon Squeezy ids are left in place; the Stripe webhook clears them on its first event;
 * - nothing is cancelled at Lemon Squeezy and neither provider is called. The report lists
 *   the Lemon Squeezy id of every linked row so cancellation can be done as its own step,
 *   because the row no longer holds that id once the webhook has run.
 */

const COLUMNS = "id, profile_id, plan_type, subscription_status, ls_subscription_id, stripe_subscription_id, stripe_customer_id";

type StaffClient = Extract<Awaited<ReturnType<typeof requireStaffApi>>, { supabase: unknown }>["supabase"];

/** Every row that holds one of the ids in the list, so conflicts on other rows are seen too. */
async function loadRows(db: StaffClient, inputs: StripeLinkInput[]): Promise<{ rows: StripeLinkRow[]; error: string | null }> {
  const found = new Map<string, StripeLinkRow>();
  const lookups: Array<[keyof StripeLinkInput, string[]]> = [
    ["ls_subscription_id", inputs.map((i) => i.ls_subscription_id)],
    ["stripe_subscription_id", inputs.map((i) => i.stripe_subscription_id)],
    ["stripe_customer_id", inputs.map((i) => i.stripe_customer_id)],
  ];
  for (const [column, values] of lookups) {
    for (let start = 0; start < values.length; start += 100) {
      const { data, error } = await db.from("subscriptions").select(COLUMNS).in(column, values.slice(start, start + 100));
      if (error) return { rows: [], error: error.message };
      for (const row of (data ?? []) as unknown as StripeLinkRow[]) found.set(row.id, row);
    }
  }
  return { rows: [...found.values()], error: null };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireStaffApi(["admin"]);
  if ("error" in auth) return auth.error as NextResponse;

  const apply = req.nextUrl.searchParams.get("apply") === "1";
  const mode = apply ? "applied" : "report only (add ?apply=1 to write)";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ mode, error: "The body is not valid JSON." }, { status: 400 });
  }

  const parsed = parseStripeLinkInputs(body);
  if (parsed.error) return NextResponse.json({ mode, error: parsed.error }, { status: 400 });

  const db = auth.supabase;
  const loaded = await loadRows(db, parsed.rows);
  if (loaded.error) return NextResponse.json({ mode, error: `Could not read subscriptions: ${loaded.error}` }, { status: 500 });

  const outcomes = matchStripeLinks(parsed.rows, loaded.rows);
  const of = (status: StripeLinkOutcome["status"]) => outcomes.filter((o) => o.status === status);
  const matched = of("matched");

  const linked: StripeLinkOutcome[] = [];
  const failed: Array<StripeLinkOutcome & { error: string }> = [];
  if (apply) {
    // Never the matched list directly: stripeLinksToWrite drops anything that is not a
    // clean match, so a conflict can never reach the update below.
    for (const row of stripeLinksToWrite(outcomes)) {
      // Only these two columns. The filters repeat what the matcher saw, so a row that
      // changed since it was read (another Lemon id, another Stripe subscription) is not written.
      const { data, error } = await db
        .from("subscriptions")
        .update({ stripe_subscription_id: row.stripe_subscription_id, stripe_customer_id: row.stripe_customer_id })
        .eq("id", row.subscription_id as string)
        .eq("ls_subscription_id", row.ls_subscription_id)
        .or(`stripe_subscription_id.is.null,stripe_subscription_id.eq.${row.stripe_subscription_id}`)
        .select("id");
      if (error) failed.push({ ...row, error: error.message });
      else if (!data || data.length === 0) failed.push({ ...row, error: "The row changed after it was read. Nothing was written. Run the report again." });
      else linked.push(row);
    }
  }

  // The Stripe webhook clears ls_subscription_id on its first event for a linked row, so
  // this list is the record of which Lemon Squeezy subscriptions still have to be stopped.
  const lemonSource = [...(apply ? linked : matched), ...of("already_linked")];
  const lemonSubscriptions = lemonSource.map((o) => ({
    ls_subscription_id: o.ls_subscription_id,
    stripe_subscription_id: o.stripe_subscription_id,
    subscription_id: o.subscription_id,
    profile_id: o.profile_id,
    status: o.status === "matched" ? (apply ? "linked" : "to link") : "already linked",
  }));

  const report = {
    mode,
    counts: {
      received: parsed.rows.length + parsed.invalid.length,
      matched: matched.length,
      ...(apply ? { linked: linked.length, failed: failed.length } : {}),
      already_linked: of("already_linked").length,
      conflict: of("conflict").length,
      unmatched: of("unmatched").length,
      invalid: parsed.invalid.length,
    },
    ...(apply ? { linked, failed } : { to_link: matched }),
    already_linked: of("already_linked"),
    conflicts: of("conflict"),
    unmatched: of("unmatched"),
    invalid: parsed.invalid,
    lemon_subscriptions: {
      note: "Nothing was cancelled at Lemon Squeezy. These are the Lemon Squeezy subscriptions behind the linked rows. Keep this list: the Stripe webhook clears the id from the row on its first event.",
      rows: lemonSubscriptions,
    },
  };

  if (apply) {
    await recordOperationalEvent(db, {
      action: "billing.stripe_link.applied",
      entityType: "subscription",
      userId: auth.profile.id,
      level: failed.length > 0 ? "warning" : "info",
      metadata: {
        counts: report.counts,
        linked: linked.map((o) => ({ subscription_id: o.subscription_id, ls_subscription_id: o.ls_subscription_id, stripe_subscription_id: o.stripe_subscription_id })),
        failed: failed.map((o) => ({ subscription_id: o.subscription_id, ls_subscription_id: o.ls_subscription_id, error: o.error })),
      },
    });
  }

  return NextResponse.json(report);
}
