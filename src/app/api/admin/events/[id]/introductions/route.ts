import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEventById } from "@/lib/icfo-events/queries";
import { loadNetworkingBoard } from "@/lib/icfo-events/networking-board";
import { contactsFor, createIntroductions, listTemplates } from "@/lib/icfo-events/introductions-server";
import {
  sendIntroductionDigest, sendIntroductionEmail, type Sender,
} from "@/lib/icfo-events/introduction-emails";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { pairTypeFor } from "@/lib/icfo-events/pair-types";
import { formatSlot } from "@/lib/icfo-events/calendar-links";
import { planBulkSend } from "@/lib/icfo-events/introductions";

export const dynamic = "force-dynamic";
// Sending is a network call per email. Give the function room, and still bound
// the work below — a request that cannot finish is worse than one that returns
// having done part of the job.
export const maxDuration = 300;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

// Not exported: a route file may only export route handlers and Next's own
// config keys, and the board keeps its own copy for the slider.
const MAX_PER_INVESTOR = 25;

/**
 * Emails one press may send.
 *
 * 1,515 selected matches is minutes of sequential sending; the function times
 * out, the button spins forever and nobody knows what was sent. A press now
 * does a bounded batch and reports what is left, so pressing again continues.
 */
const MAX_PER_REQUEST = 150;

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
  /** Who the mail comes from. Gmail takes replies out of the platform. */
  sendVia: z.enum(["icapos", "gmail"]).default("icapos"),
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
    // One batch per press. Strongest first, so the best introductions go out
    // first whatever happens to the rest.
    const batch = capped.keep.slice(0, MAX_PER_REQUEST);
    const remaining = capped.keep.length - batch.length;
    const pairs = batch;

    // Never offer a sender that cannot send: Gmail needs a connected account
    // with the send scope, and failing after the rows exist would leave
    // introductions recorded that nobody received.
    if (parsed.data.sendVia === "gmail" && !parsed.data.dryRun) {
      const status = await getGoogleConnectionStatus(auth.supabase, auth.profile.id);
      if (!status.connected) {
        return NextResponse.json(
          { error: "Google account not connected. Connect it in Settings, or send from iCapOS.", code: "gmail_not_connected" },
          { status: 400 },
        );
      }
      if (!status.scopes.includes("https://www.googleapis.com/auth/gmail.send")) {
        return NextResponse.json(
          { error: "Gmail send permission not granted. Reconnect your Google account, or send from iCapOS.", code: "gmail_no_scope" },
          { status: 400 },
        );
      }
    }

    const sender: Sender = parsed.data.sendVia === "gmail"
      ? { via: "gmail", userId: auth.profile.id }
      : { via: "icapos" };

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
        // What one press would actually do.
        thisBatch: batch.length,
        remaining,
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
      parsed.data.sendVia,
    );

    // Send only for what was actually created, so a repeat click can't mail
    // the same person twice.
    const admin = createServiceRoleClient() as unknown as import("@supabase/supabase-js").SupabaseClient;
    const [event, templates, fresh] = await Promise.all([
      getEventById(auth.supabase, eventId).catch(() => null),
      listTemplates(),
      // Only this batch's rows: loading every sent row for the event grows with
      // the event and is not needed to mail the ones just created.
      admin.from("event_introductions").select("*")
        .eq("event_id", eventId)
        .eq("status", "sent")
        .in("investor_reg_id", [...new Set(pairs.map((p) => p.a.registrationId))]),
    ]);
    const invitation = templates.find((t) => t.kind === "invitation");
    // The event's own date, for the fixed networking sentence.
    const eventWhen = event?.startsAt ? formatSlot(event.startsAt, event.timezone ?? null) : null;
    // A pairing between equals gets the peer message: two investors are not
    // pitching each other, and the founder copy would read as nonsense.
    const peer = templates.find((t) => t.kind === "peer_invitation") ?? invitation;

    let sent = 0;
    if (invitation && event) {
      const rows = (fresh.data ?? []) as Record<string, unknown>[];
      const byPair = new Map(pairs.map((p) => [[p.a.registrationId, p.b.registrationId].sort().join("|"), p]));
      // One read for both sides: the invitation quotes the founder's own
      // answers — their pitch, stage and round — not just their name.
      const people = await contactsFor(
        rows.flatMap((r) => [String(r.investor_reg_id), String(r.founder_reg_id)]),
      );

      // Group by who receives it. One match is one email; several become one
      // email with a block each, since forty perfectly reasonable messages in
      // one minute read as spam whatever each of them says.
      type Piece = {
        introductionId: string;
        founder: {
          name: string; company: string | null; pitch: string | null;
          stage: string | null; raising: string | null; roundSize: string | null;
        };
        sharedSectors: string[];
        /** True when the two sides are equals — a peer invitation, not a pitch. */
        peer: boolean;
      };
      const byInvestor = new Map<string, { email: string; name: string; company: string | null; items: Piece[] }>();

      for (const r of rows) {
        const key = [String(r.investor_reg_id), String(r.founder_reg_id)].sort().join("|");
        const pair = byPair.get(key);
        if (!pair) continue;
        const investor = people.get(String(r.investor_reg_id));
        const founder = people.get(String(r.founder_reg_id));
        if (!investor?.email) continue;

        const bucket = byInvestor.get(investor.registrationId) ?? {
          email: investor.email, name: investor.name, company: investor.company, items: [],
        };
        bucket.items.push({
          introductionId: String(r.id),
          founder: {
            name: founder?.name ?? pair.b.name,
            company: founder?.company ?? pair.b.company,
            pitch: founder?.pitch ?? null,
            stage: founder?.stage ?? null,
            raising: founder?.raising ?? null,
            roundSize: founder?.roundSize ?? null,
          },
          sharedSectors: pair.sharedInterests,
          peer: pairTypeFor(pair.pairType)?.template === "peer_invitation",
        });
        byInvestor.set(investor.registrationId, bucket);
      }

      for (const person of byInvestor.values()) {
        if (person.items.length === 1) {
          const only = person.items[0];
          const ok = await sendIntroductionEmail({
            introductionId: only.introductionId,
            to: person.email,
            template: only.peer ? (peer ?? invitation) : invitation,
            sender,
            investor: { name: person.name, company: person.company },
            founder: only.founder,
            eventTitle: event.title,
            eventWhen,
            sharedSectors: only.sharedSectors,
            baseUrl: BASE_URL,
          });
          if (ok) sent += 1;
          continue;
        }

        const ok = await sendIntroductionDigest({
          to: person.email,
          investorName: person.name,
          eventTitle: event.title,
          eventWhen,
          items: person.items,
          baseUrl: BASE_URL,
          sender,
          // A digest carrying any peer pair must not call them founders.
          noun: person.items.every((i) => !i.peer) ? "founders" : "people",
        });
        // One email, however many introductions it carries — counting it once
        // is what makes "emails sent" mean something.
        if (ok) sent += 1;
      }
    }

    return NextResponse.json({
      created: result.created,
      sent,
      skipped: result.skipped,
      held: capped.held,
      // Left for the next press. The rows were never created, so nothing is
      // recorded as sent that was not.
      remaining,
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't send the introductions." }, { status: 500 });
  }
}

