import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listTemplates, runFollowUpPass, type IntroRow } from "@/lib/icfo-events/introductions-server";
import { sendIntroductionEmail } from "@/lib/icfo-events/introduction-emails";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

/**
 * The daily founder follow-up.
 *
 * Capped at two per introduction, never after a decline, and silent inside the
 * last day before an event — those limits live in `shouldFollowUp`, and the
 * response reports every skip so a quiet day is explainable rather than
 * indistinguishable from a broken job.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = createServiceRoleClient() as unknown as SupabaseClient;
    const templates = await listTemplates();
    const followUp = templates.find((t) => t.kind === "follow_up");
    if (!followUp) {
      return NextResponse.json({ error: "No follow-up template — nothing sent." }, { status: 500 });
    }

    const result = await runFollowUpPass(async (intro: IntroRow) => {
      const people = await sidesOf(db, intro);
      if (!people) return false;
      return sendIntroductionEmail({
        introductionId: intro.id,
        to: people.investorEmail,
        template: followUp,
        investor: { name: people.investorName, company: people.investorCompany },
        founder: { name: people.founderName, company: people.founderCompany },
        eventTitle: people.eventTitle,
        sharedSectors: intro.sharedSectors,
        baseUrl: BASE_URL,
      });
    });

    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "The follow-up pass failed." }, { status: 500 });
  }
}

type Sides = {
  investorEmail: string;
  investorName: string;
  investorCompany: string | null;
  founderName: string;
  founderCompany: string | null;
  eventTitle: string;
};

/** Both registrations plus the event title, or null when anything is missing. */
async function sidesOf(db: SupabaseClient, intro: IntroRow): Promise<Sides | null> {
  const [regs, event] = await Promise.all([
    db.from("registrations")
      .select("id, answers, profiles:attendee_id(full_name, email)")
      .in("id", [intro.investorRegId, intro.founderRegId]),
    db.from("events").select("title").eq("id", intro.eventId).maybeSingle(),
  ]);

  const rows = (regs.data ?? []) as Record<string, unknown>[];
  const find = (id: string) => rows.find((r) => String(r.id) === id);
  const investor = find(intro.investorRegId);
  const founder = find(intro.founderRegId);
  if (!investor || !founder) return null;

  const read = (r: Record<string, unknown>) => {
    const answers = (r.answers as Record<string, unknown> | null) ?? {};
    const p = r.profiles as { full_name?: string | null; email?: string | null } | null;
    const str = (k: string) => (typeof answers[k] === "string" ? (answers[k] as string).trim() : "");
    return {
      name: str("name") || p?.full_name?.trim() || "there",
      email: str("email") || p?.email || "",
      company: str("company") || null,
    };
  };

  const inv = read(investor);
  if (!inv.email.includes("@")) return null;
  const fdr = read(founder);

  return {
    investorEmail: inv.email,
    investorName: inv.name,
    investorCompany: inv.company,
    founderName: fdr.name,
    founderCompany: fdr.company,
    eventTitle: String((event.data as { title?: string } | null)?.title ?? "an iCFO event"),
  };
}
