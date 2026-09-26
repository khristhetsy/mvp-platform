import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { claudeComplete, isClaudeConfigured } from "@/lib/claude";
import { createGmailDraft } from "@/lib/integrations/gmail-drafts";
import { loadSignature, effectiveSignature } from "@/lib/email/signature";
import { deliverReachOut, gmailError, logOutreach } from "@/lib/founder-outreach/deliver-reach-out";
import {
  cancelScheduledReachOut,
  listScheduledReachOuts,
  sendScheduledReachOutNow,
  validSendAt,
} from "@/lib/founder-outreach/scheduled-reach-outs";
import { usZoneForState } from "@/lib/founder-outreach/us-time-zone";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/** Which letter this stage needs. A cleared stage and a stage locked three gates
 *  back are both "nothing to do", but they call for completely different emails. */
const situations = ["blocking", "cleared", "locked-near", "locked-far"] as const;

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("draft"),
    items: z.array(z.string()).default([]),
    stage: z.string().optional(),
    situation: z.enum(situations).default("blocking"),
    /** The stage's own diagnosis in plain lines — the score, the gaps, the ranked
     *  fixes. Without this the model only sees item labels and can do no better
     *  than "these are still pending". */
    facts: z.array(z.string()).max(40).default([]),
  }),
  z.object({
    action: z.enum(["save-draft", "send", "schedule"]),
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(8000),
    appendSignature: z.boolean().default(true),
    alsoNudge: z.boolean().default(false),
    /** iCapOS sends from the platform address with reply-to the staff member and
     *  needs no Google connection; gmail sends as the staff member personally. */
    via: z.enum(["icapos", "gmail"]).default("icapos"),
    /** For "schedule": when to send, as an ISO instant. */
    sendAt: z.string().optional(),
  }),
  z.object({
    action: z.enum(["cancel-scheduled", "send-scheduled-now"]),
    scheduledId: z.string().uuid(),
  }),
]);

const BRIEF: Record<(typeof situations)[number], string> = {
  blocking:
    "Items in this stage are blocking. Name the specific gaps and the numbers, then give the ranked steps that close them. Be concrete about what each step is worth.",
  cleared:
    "Nothing is blocking this stage. Do NOT write a congratulations note. Confirm it is clear in one line, then raise the single most useful thing in the facts — a setting worth double-checking, or what happens next.",
  "locked-near":
    "This stage is locked by the one before it. Say plainly that nothing is being withheld and no approval is pending, give the exact gap and what closes it, and say it unlocks on its own.",
  "locked-far":
    "This stage is several gates away. Spell out the chain of dependencies so it reads as a plan rather than a refusal, and point at the one stage that actually matters right now.",
};

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const input = parsed.data;

  // ---- Scheduled emails: cancel, or send now ----
  if ("scheduledId" in input) {
    if (input.action === "cancel-scheduled") {
      const ok = await cancelScheduledReachOut(id, input.scheduledId);
      return ok
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: "This email has already been sent or canceled." }, { status: 409 });
    }
    const r = await sendScheduledReachOutNow(id, input.scheduledId);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 });
  }

  const admin = createServiceRoleClient() as unknown as SupabaseClient<Database>;
  const { data: company } = await admin
    .from("companies")
    .select("id, company_name, founder_id")
    .eq("id", id)
    .maybeSingle();
  const co = company as { id: string; company_name: string | null; founder_id: string | null } | null;
  if (!co?.founder_id) return NextResponse.json({ error: "Company or founder not found." }, { status: 404 });

  const { data: founder } = await admin.from("profiles").select("id, full_name, email").eq("id", co.founder_id).maybeSingle();
  const f = founder as { id: string; full_name: string | null; email: string | null } | null;
  if (!f?.email) return NextResponse.json({ error: "Founder has no email on file." }, { status: 400 });

  // ---- Draft with AI from the stage's diagnosis ----
  if (input.action === "draft") {
    const first = (f.full_name ?? "there").split(" ")[0];
    const { items, facts, situation } = input;
    const stage = input.stage ?? "this stage";

    const subject =
      situation === "cleared"
        ? `Your iCapOS ${stage} is clear — one thing worth checking`
        : situation === "locked-far"
          ? `Why ${stage} is greyed out — the full path`
          : situation === "locked-near"
            ? `Where you are on ${stage} — and what opens it`
            : `A couple of things blocking your iCapOS ${stage}`;

    // Facts beat labels: if the caller sent a diagnosis, the fallback quotes it
    // rather than listing item names, so even an unconfigured Claude says something.
    const detail = facts.length ? facts : items;
    const fallbackBody =
      `Hi ${first},\n\n` +
      (situation === "cleared"
        ? `Your ${stage} is clear — nothing outstanding.\n`
        : situation === "locked-far" || situation === "locked-near"
          ? `Quick note on ${stage}:\n`
          : `A couple of things left in ${stage}:\n`) +
      (detail.length ? detail.map((i, n) => `${n + 1}. ${i}`).join("\n") : "1. Finish the remaining steps") +
      `\n\nReply here if anything's unclear and we'll help.`;

    if (!isClaudeConfigured()) return NextResponse.json({ subject, body: fallbackBody });

    try {
      const draft = await claudeComplete(
        [
          {
            role: "user",
            content:
              `Write an outreach email to ${f.full_name ?? "the founder"} at ${co.company_name ?? "their company"}, ` +
              `a founder on the iCapOS fundraising platform. Stage: ${stage}.\n\n` +
              `${BRIEF[situation]}\n\n` +
              `What we know about their ${stage} right now:\n` +
              (detail.length ? detail.map((d) => `- ${d}`).join("\n") : "- no specific findings") +
              `\n\nUse the real numbers above — never say "some items are pending" when you have been given ` +
              `the actual figures. 150-180 words, plain text, short greeting, no sign-off block ` +
              `(a signature is appended separately). Warm and direct; no funding promises.`,
          },
        ],
        {
          maxTokens: 600,
          temperature: 0.4,
          system:
            "You are an iCapOS specialist helping founders prepare to raise capital. You write like a person who has actually read the file: specific figures, named documents, concrete next steps. No filler and no funding promises.",
        },
      );
      return NextResponse.json({ subject, body: draft || fallbackBody });
    } catch {
      return NextResponse.json({ subject, body: fallbackBody });
    }
  }

  // ---- Save to Gmail drafts / Send from Gmail ----
  const supabase = await createServerSupabaseClient();
  let html = esc(input.body).replace(/\n/g, "<br>");
  if (input.appendSignature) {
    const sig = effectiveSignature(await loadSignature(supabase, profile.id));
    html += `<br><br>${sig}`;
  }

  const msg = { to: f.email, subject: input.subject, body: input.body, html };
  const via = input.via;

  if (input.action === "save-draft") {
    // Only Gmail has a drafts folder to save into. Sending with iCapOS is
    // immediate, so a draft there would have nowhere to live.
    if (via === "icapos") {
      return NextResponse.json(
        { error: "Drafts are saved to Gmail. Switch the sender to your Gmail, or send with iCapOS directly." },
        { status: 400 },
      );
    }
    const r = await createGmailDraft(profile.id, msg);
    if ("error" in r) return NextResponse.json({ error: gmailError(r.error) }, { status: 400 });
    await logOutreach(admin as unknown as SupabaseClient, id, profile.id, "draft", via);
    return NextResponse.json({ ok: true, draftId: r.id });
  }

  // schedule: stored now, sent by /api/cron/scheduled-reach-outs at sendAt
  if (input.action === "schedule") {
    const sendAt = input.sendAt ?? "";
    const invalid = validSendAt(sendAt);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    const { error } = await (admin as unknown as SupabaseClient).from("scheduled_reach_outs").insert({
      company_id: id,
      founder_id: f.id,
      created_by: profile.id,
      to_email: f.email,
      subject: input.subject,
      body: input.body,
      html,
      via,
      reply_to: profile.email ?? null,
      also_nudge: input.alsoNudge,
      send_at: new Date(sendAt).toISOString(),
    });
    if (error) return NextResponse.json({ error: "Could not schedule that email." }, { status: 500 });
    return NextResponse.json({ ok: true, sendAt: new Date(sendAt).toISOString() });
  }

  // send
  const r = await deliverReachOut(admin as unknown as SupabaseClient, {
    companyId: id,
    founderId: f.id,
    actorId: profile.id,
    actorEmail: profile.email ?? null,
    to: f.email,
    subject: input.subject,
    body: input.body,
    html,
    via,
    alsoNudge: input.alsoNudge,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(r.channel ? { ok: true, channel: r.channel } : { ok: true });
}

/** Scheduled emails for this company, and the founder's US time zone. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const { id } = await ctx.params;
  const admin = createServiceRoleClient() as unknown as SupabaseClient<Database>;
  const [{ data: company }, items] = await Promise.all([
    admin.from("companies").select("state, country").eq("id", id).maybeSingle(),
    listScheduledReachOuts(id),
  ]);
  const co = company as { state: string | null; country: string | null } | null;
  return NextResponse.json({ items, zone: usZoneForState(co?.state, co?.country) });
}
