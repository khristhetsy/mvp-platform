import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { claudeComplete, isClaudeConfigured } from "@/lib/claude";
import { getSupportSettings } from "@/lib/support/settings";
import { logSupportEvent, type AiCost } from "@/lib/support/events";
import { REWRITE_SYSTEM, rewritePrompt, rewriteSchema, signWithFirstName, writePrompt } from "@/lib/support/manual-message";
import { PLAN_LABELS, type PlanType } from "@/lib/subscriptions/plans";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/support/rewrite: AI help for a message staff are writing to a
 * client before any thread exists (New message to client). The existing
 * /api/admin/support/[id]/draft does the same for a reply inside a thread.
 *
 * Draft only. Nothing is saved or sent; staff read it and choose Use suggestion.
 * Follows the Support setting "Draft replies for staff".
 */
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const parsed = rewriteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const input = parsed.data;

  if (!isClaudeConfigured() || !(await getSupportSettings()).ai.drafts) {
    return NextResponse.json({ draft: "", unavailable: true });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceRoleClient() as unknown as SupabaseClient<any>;

  // The message goes out as the assignee, so the draft is signed by them.
  let signer = profile.full_name?.trim() || "";
  if (input.assigneeId && input.assigneeId !== profile.id) {
    const { data: owner } = await svc.from("profiles").select("full_name").eq("id", input.assigneeId).maybeSingle();
    signer = ((owner as { full_name: string | null } | null)?.full_name ?? "").trim() || signer;
  }

  let prompt: string;
  if (input.mode === "rewrite") {
    prompt = rewritePrompt(input.tone, input.base);
  } else {
    let requesterName: string | null = null;
    let planLabel: string | null = null;
    if (input.requesterId) {
      const [{ data: p }, { data: sub }] = await Promise.all([
        svc.from("profiles").select("full_name").eq("id", input.requesterId).maybeSingle(),
        svc.from("subscriptions").select("plan_type").eq("profile_id", input.requesterId).maybeSingle(),
      ]);
      requesterName = (p as { full_name: string | null } | null)?.full_name?.trim() || null;
      const plan = (sub as { plan_type: PlanType } | null)?.plan_type;
      planLabel = plan ? PLAN_LABELS[plan] ?? null : null;
    }
    prompt = writePrompt({ subject: input.subject, requesterName, planLabel });
  }

  try {
    let cost: AiCost | null = null;
    const draft = await claudeComplete([{ role: "user", content: prompt }], {
      usage: { category: "internal", feature: "admin_support" },
      maxTokens: 400,
      temperature: 0.4,
      system: REWRITE_SYSTEM,
      onUsage: (u) => (cost = u),
    });
    await logSupportEvent({
      requestId: null,
      actor: "ai",
      actorUserId: profile.id,
      kind: "ai_draft",
      summary:
        input.mode === "rewrite"
          ? `AI rewrote a new message (${input.tone}) for ${profile.full_name ?? "staff"}`
          : `AI drafted a new message for ${profile.full_name ?? "staff"}`,
      detail: "Not sent · waiting for staff review",
      ai: cost,
    });
    return NextResponse.json({ draft: signWithFirstName(draft, signer) });
  } catch {
    return NextResponse.json({ draft: "", unavailable: true });
  }
}
