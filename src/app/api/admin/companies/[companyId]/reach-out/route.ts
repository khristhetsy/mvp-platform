import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { claudeComplete, isClaudeConfigured } from "@/lib/claude";
import { sendViaGmail } from "@/lib/integrations/gmail-send";
import { createGmailDraft } from "@/lib/integrations/gmail-drafts";
import { loadSignature, effectiveSignature } from "@/lib/email/signature";
import { createNotification } from "@/lib/notifications/notifications";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("draft"), items: z.array(z.string()).default([]), stage: z.string().optional() }),
  z.object({
    action: z.enum(["save-draft", "send"]),
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(8000),
    appendSignature: z.boolean().default(true),
    alsoNudge: z.boolean().default(false),
  }),
]);

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ companyId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const { companyId } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const admin = createServiceRoleClient() as unknown as SupabaseClient<Database>;
  const { data: company } = await admin
    .from("companies")
    .select("id, company_name, founder_id")
    .eq("id", companyId)
    .maybeSingle();
  const co = company as { id: string; company_name: string | null; founder_id: string | null } | null;
  if (!co?.founder_id) return NextResponse.json({ error: "Company or founder not found." }, { status: 404 });

  const { data: founder } = await admin.from("profiles").select("id, full_name, email").eq("id", co.founder_id).maybeSingle();
  const f = founder as { id: string; full_name: string | null; email: string | null } | null;
  if (!f?.email) return NextResponse.json({ error: "Founder has no email on file." }, { status: 400 });

  // ---- Draft with AI from the pending items ----
  if (parsed.data.action === "draft") {
    const first = (f.full_name ?? "there").split(" ")[0];
    const items = parsed.data.items;
    const fallbackBody =
      `Hi ${first},\n\nYou're almost through ${parsed.data.stage ?? "this stage"} — a couple of things left:\n` +
      (items.length ? items.map((i, n) => `${n + 1}. ${i}`).join("\n") : "1. Finish the remaining steps") +
      `\n\nReply here if anything's unclear and we'll help.`;
    if (!isClaudeConfigured()) {
      return NextResponse.json({ subject: `A couple of things to finish your iCapOS ${parsed.data.stage ?? "setup"}`, body: fallbackBody });
    }
    try {
      const draft = await claudeComplete(
        [
          {
            role: "user",
            content: `Write a short, warm outreach email to a founder named ${f.full_name ?? "the founder"} at ${co.company_name ?? "their company"}. They're on the iCapOS fundraising platform and these items are still pending in their ${parsed.data.stage ?? "current"} stage:\n${items.map((i) => `- ${i}`).join("\n") || "- remaining setup steps"}\n\nAsk them to complete these specific items to move forward, offer help, keep it under 110 words, plain text, short greeting, no sign-off block (a signature is appended separately).`,
          },
        ],
        { maxTokens: 320, temperature: 0.4, system: "You are an iCapOS specialist helping founders prepare to raise capital. Specific and encouraging. No funding promises." },
      );
      return NextResponse.json({ subject: `A couple of things to finish your iCapOS ${parsed.data.stage ?? "setup"}`, body: draft || fallbackBody });
    } catch {
      return NextResponse.json({ subject: `A couple of things to finish your iCapOS ${parsed.data.stage ?? "setup"}`, body: fallbackBody });
    }
  }

  // ---- Save to Gmail drafts / Send from Gmail ----
  const supabase = await createServerSupabaseClient();
  let html = esc(parsed.data.body).replace(/\n/g, "<br>");
  if (parsed.data.appendSignature) {
    const sig = effectiveSignature(await loadSignature(supabase, profile.id));
    html += `<br><br>${sig}`;
  }

  const msg = { to: f.email, subject: parsed.data.subject, body: parsed.data.body, html };

  if (parsed.data.action === "save-draft") {
    const r = await createGmailDraft(profile.id, msg);
    if ("error" in r) return NextResponse.json({ error: gmailError(r.error) }, { status: 400 });
    await logOutreach(admin, companyId, profile.id, "draft");
    return NextResponse.json({ ok: true, draftId: r.id });
  }

  // send
  const r = await sendViaGmail({ userId: profile.id, to: f.email, subject: parsed.data.subject, body: parsed.data.body, html });
  if ("error" in r) return NextResponse.json({ error: gmailError(r.error) }, { status: 400 });

  if (parsed.data.alsoNudge) {
    await createNotification({
      recipientUserId: f.id,
      type: "founder_outreach_nudge",
      title: "A note from the iCapOS team",
      message: parsed.data.subject,
      entityType: "company",
      entityId: companyId,
    }).catch(() => {});
  }
  await logOutreach(admin, companyId, profile.id, "sent");
  return NextResponse.json({ ok: true });
}

function gmailError(e: Error): string {
  return /token|scope|connect|auth/i.test(e.message)
    ? "Your Gmail isn't connected. Connect Google in Integrations, then try again."
    : "Gmail request failed. Try again.";
}

async function logOutreach(admin: SupabaseClient<Database>, companyId: string, actorId: string, kind: "draft" | "sent") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as unknown as SupabaseClient<any>).from("operational_activity_events").insert({
      event_type: kind === "sent" ? "founder_outreach_sent" : "founder_outreach_drafted",
      actor_user_id: actorId,
      entity_id: companyId,
      metadata: { company_id: companyId, via: "gmail" },
    });
  } catch {
    /* best-effort */
  }
}
