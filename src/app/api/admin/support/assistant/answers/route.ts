import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { violatesGuardrails } from "@/lib/ai-site/guardrails";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { MAX_ANSWERS } from "@/lib/support/assistant-training";

export const dynamic = "force-dynamic";

const schema = z.object({
  question: z.string().trim().min(3).max(200),
  answer: z.string().trim().min(2).max(600),
});

/**
 * Teach the support assistant an answer. When a founder asks something close to
 * the question, the assistant replies with this answer word for word, before the
 * AI runs. The platform's guardrails apply: no guarantees or funding promises.
 */
export async function POST(req: Request): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write the question and a short answer." }, { status: 400 });
  const { question, answer } = parsed.data;
  if (violatesGuardrails(answer)) {
    return NextResponse.json({ error: "Answers cannot include guarantees or funding promises." }, { status: 400 });
  }
  const db = serviceRoleClientUntyped();
  const { count } = await db.from("support_assistant_answers").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= MAX_ANSWERS) return NextResponse.json({ error: `Up to ${MAX_ANSWERS} taught answers. Remove one first.` }, { status: 400 });
  const { data, error } = await db.from("support_assistant_answers").insert({ question, answer, created_by: profile.id }).select("id, question, answer").single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not save." }, { status: 500 });
  return NextResponse.json({ answer: data });
}

export async function DELETE(req: Request): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  await serviceRoleClientUntyped().from("support_assistant_answers").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
