import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEventById } from "@/lib/icfo-events/queries";
import { loadNetworkingBoard } from "@/lib/icfo-events/networking-board";
import { contactsFor, createIntroductions, listTemplates } from "@/lib/icfo-events/introductions-server";
import { sendIntroductionEmail } from "@/lib/icfo-events/introduction-emails";
import { planBulkSend } from "@/lib/icfo-events/introductions";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

// Not exported: a route file may only export route handlers and Next's own
// config keys, and the board keeps its own copy for the slider.
const MAX_PER_INVESTOR = 25;

const schema = z.object({
  /** Pair keys from the board — `registrationId|registrationId`. */
  pairKeys: z.array(z.string()).max(5000).default([]),
  /**
   * Select every match, including the ones past the 400 the board renders.
   * The keys for those were never sent to the browser, so the server takes
   * the whole set itself rather than trusting a list it did not produce.
   */
  allMatches: z.boolean().default(false),
  /**
   * How many introductions one investor may receive in this send. The rest
   * stay unsent and unrecorded, so the next send picks them up.
   */
  maxPerInvestor: z.number().int().min(1).max(MAX_PER_INVESTOR).default(MAX_PER_INVESTOR),
  /** Look only: report who would be mailed, and how often. */
  dryRun: z.boolean().default(false),
});

/**
 * Trim a selection to the cap, strongest first.
 *
 * An investor matched to forty founders would otherwise get forty emails in
 * one morning. What is dropped here is not recorded anywhere — no introduction
 * row, no "sent" status — precisely so tomorrow's send finds it again.
 */
function applyCap<T extends { a: { registrationId: string }; score: number }>(
  pairs: T[],
  max: number,
): { keep: T[]; held: number; cappedInvestors: number } {
  const byScore = [...pairs].sort((p, q) => q.score - p.score);
  const seen = new Map<string, number>();
  const keep: T[] = [];
  for (const p of byScore) {
    const n = seen.get(p.a.registrationId) ?? 0;
    if (n >= max) continue;
    seen.set(p.a.registrationId, n + 1);
    keep.push(p);
  }
  const counts = new Map<string, number>();
  for (const p of pairs) counts.set(p.a.registrationId, (counts.get(p.a.registrationId) ?? 0) + 1);
  return {
    keep,
    held: pairs.length - keep.length,
    cappedInvestors: [...counts.values()].filter((n) => n > max).length,
  };
}

/**
 * Send introductions for the selected matches.
 *
 * The pairs are re-derived from the board rather than trusted from the client:
 * the score and shared sectors are frozen into the row and printed in the
 * email, so they must come from the same computation, not from a stale tab.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: eventId } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }

    const board = await loadNetworkingBoard(eventId);

    // Only a pair nobody has been introduced for can be introduced.
    const introducible = board.pairs.filter((p) => p.status === "none");
    const wanted = new Set(parsed.data.pairKeys);
    const selected = parsed.data.allMatches
      ? introducible
      : introducible.filter((p) => wanted.has(p.key));
    if (!selected.length) {
      return NextResponse.json({ error: "Those matches are no longer in the list." }, { status: 400 });
    }

    const capped = applyCap(selected, parsed.data.maxPerInvestor);
    const pairs = capped.keep;

    // An investor matched to six founders would otherwise get six separate
    // emails from us on one morning, which reads as spam whatever each says.
    const plan = planBulkSend(pairs.map((p) => ({ investorRegId: p.a.registrationId, introductionId: p.key })));
    if (parsed.data.dryRun) {
      return NextResponse.json({
        recipients: plan.perRecipient.length,
        emails: pairs.length,
        wouldRepeat: plan.wouldRepeat,
        held: capped.held,
        cappedInvestors: capped.cappedInvestors,
        selected: selected.length,
      });
    }

    const result = await createIntroductions(
      eventId,
      pairs.map((p) => ({
        investorRegId: p.a.registrationId,
        founderRegId: p.b.registrationId,
        score: p.score,
        sharedSectors: p.sharedInterests,
      })),
      auth.profile.id,
    );

    // Send only for what was actually created, so a repeat click can't mail
    // the same person twice.
    const admin = createServiceRoleClient() as unknown as import("@supabase/supabase-js").SupabaseClient;
    const [event, templates, fresh] = await Promise.all([
      getEventById(auth.supabase, eventId).catch(() => null),
      listTemplates(),
      admin.from("event_introductions").select("*").eq("event_id", eventId).eq("status", "sent"),
    ]);
    const invitation = templates.find((t) => t.kind === "invitation");

    let sent = 0;
    if (invitation && event) {
      const rows = (fresh.data ?? []) as Record<string, unknown>[];
      const byPair = new Map(pairs.map((p) => [[p.a.registrationId, p.b.registrationId].sort().join("|"), p]));
      // One read for both sides: the invitation quotes the founder's own
      // answers — their pitch, stage and round — not just their name.
      const people = await contactsFor(
        rows.flatMap((r) => [String(r.investor_reg_id), String(r.founder_reg_id)]),
      );

      for (const r of rows) {
        const key = [String(r.investor_reg_id), String(r.founder_reg_id)].sort().join("|");
        const pair = byPair.get(key);
        if (!pair) continue;
        const investor = people.get(String(r.investor_reg_id));
        const founder = people.get(String(r.founder_reg_id));
        if (!investor?.email) continue;
        const ok = await sendIntroductionEmail({
          introductionId: String(r.id),
          to: investor.email,
          template: invitation,
          investor: { name: investor.name, company: investor.company },
          founder: {
            name: founder?.name ?? pair.b.name,
            company: founder?.company ?? pair.b.company,
            pitch: founder?.pitch ?? null,
            stage: founder?.stage ?? null,
            raising: founder?.raising ?? null,
            roundSize: founder?.roundSize ?? null,
          },
          eventTitle: event.title,
          sharedSectors: pair.sharedInterests,
          baseUrl: BASE_URL,
        });
        if (ok) sent += 1;
      }
    }

    return NextResponse.json({
      created: result.created,
      sent,
      skipped: result.skipped,
      held: capped.held,
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't send the introductions." }, { status: 500 });
  }
}

