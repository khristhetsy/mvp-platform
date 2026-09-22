import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEventById } from "@/lib/icfo-events/queries";
import { loadNetworkingBoard } from "@/lib/icfo-events/networking-board";
import { createIntroductions, listTemplates } from "@/lib/icfo-events/introductions-server";
import { sendIntroductionEmail } from "@/lib/icfo-events/introduction-emails";
import { planBulkSend } from "@/lib/icfo-events/introductions";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

const schema = z.object({
  /** Pair keys from the board — `registrationId|registrationId`. */
  pairKeys: z.array(z.string()).min(1).max(200),
  /** Look only: report who would be mailed, and how often. */
  dryRun: z.boolean().default(false),
});

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

    const wanted = new Set(parsed.data.pairKeys);
    const board = await loadNetworkingBoard(eventId);
    const pairs = board.pairs.filter((p) => wanted.has(p.key));
    if (!pairs.length) {
      return NextResponse.json({ error: "Those matches are no longer in the list." }, { status: 400 });
    }

    // An investor matched to six founders would otherwise get six separate
    // emails from us on one morning, which reads as spam whatever each says.
    const plan = planBulkSend(pairs.map((p) => ({ investorRegId: p.a.registrationId, introductionId: p.key })));
    if (parsed.data.dryRun) {
      return NextResponse.json({
        recipients: plan.perRecipient.length,
        emails: pairs.length,
        wouldRepeat: plan.wouldRepeat,
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
      const emails = await addressesFor(admin, rows.map((r) => String(r.investor_reg_id)));

      for (const r of rows) {
        const key = [String(r.investor_reg_id), String(r.founder_reg_id)].sort().join("|");
        const pair = byPair.get(key);
        if (!pair) continue;
        const to = emails.get(String(r.investor_reg_id));
        if (!to) continue;
        const ok = await sendIntroductionEmail({
          introductionId: String(r.id),
          to,
          template: invitation,
          investor: { name: pair.a.name, company: pair.a.company },
          founder: { name: pair.b.name, company: pair.b.company },
          eventTitle: event.title,
          sharedSectors: pair.sharedInterests,
          baseUrl: BASE_URL,
        });
        if (ok) sent += 1;
      }
    }

    return NextResponse.json({ created: result.created, sent, skipped: result.skipped });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't send the introductions." }, { status: 500 });
  }
}

/** Registration id → email, from the answers or the linked account. */
async function addressesFor(
  db: import("@supabase/supabase-js").SupabaseClient,
  regIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!regIds.length) return out;
  const { data } = await db
    .from("registrations")
    .select("id, answers, profiles:attendee_id(email)")
    .in("id", regIds);
  for (const r of ((data ?? []) as Record<string, unknown>[])) {
    const answers = (r.answers as Record<string, unknown> | null) ?? {};
    const profile = r.profiles as { email?: string | null } | null;
    const email = (typeof answers.email === "string" ? answers.email : "") || profile?.email || "";
    if (email.includes("@")) out.set(String(r.id), email);
  }
  return out;
}
