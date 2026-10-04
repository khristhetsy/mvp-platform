import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/lib/signed-links/tokens";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { SUPPORT_CONFIRM_ACTION } from "@/lib/support/emails";
import { founderConfirm, founderRate, loadRequestCtx, onFounderReply } from "@/lib/support/care";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * The founder's "Did this solve your issue?" answer from the email, with no
 * login. The signed link is the authorization and only ever touches its one
 * request: confirm, reopen, rate, or add a note on why it isn't solved.
 */
const schema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("answer"), token: z.string().min(10), solved: z.boolean() }),
  z.object({ step: z.literal("rate"), token: z.string().min(10), rating: z.number().int().min(1).max(5), comment: z.string().max(1000).nullish() }),
  z.object({ step: z.literal("note"), token: z.string().min(10), message: z.string().min(1).max(4000) }),
]);

export async function POST(req: NextRequest): Promise<Response> {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const requestId = verifyToken({ token: parsed.data.token, kind: "support", action: SUPPORT_CONFIRM_ACTION });
  if (!requestId) return NextResponse.json({ error: "This link has expired. Open your request in iCapOS instead." }, { status: 410 });

  const ctx = await loadRequestCtx(requestId);
  if (!ctx) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  const ownerName = ctx.owner?.name ?? "Our team";

  if (parsed.data.step === "answer") {
    const r = await founderConfirm(requestId, parsed.data.solved, "email");
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, status: r.status, changed: r.changed, alreadySolved: r.alreadySolved, ownerName, subject: ctx.request.subject });
  }

  if (parsed.data.step === "rate") {
    // Only a request the founder confirmed as solved can be rated from the email.
    if (ctx.request.csat !== 1) return NextResponse.json({ error: "This request isn't marked solved." }, { status: 409 });
    const r = await founderRate(requestId, parsed.data.rating, parsed.data.comment ?? null);
    return "error" in r ? NextResponse.json({ error: r.error }, { status: 400 }) : NextResponse.json({ ok: true });
  }

  // "What's still not working?" lands in the thread as the founder's message,
  // only on a request that is open (just reopened by "No").
  if (ctx.request.status !== "open") return NextResponse.json({ error: "This request isn't open. Reply from iCapOS instead." }, { status: 409 });
  const message = parsed.data.message;
  const { error } = await (createServiceRoleClient() as unknown as SupabaseClient).from("support_messages").insert({
    request_id: requestId,
    author_user_id: ctx.request.founder_id,
    author_role: "founder",
    body: message.trim().slice(0, 4000),
  });
  if (error) return NextResponse.json({ error: "Couldn't send. Try again." }, { status: 500 });
  after(async () => {
    try {
      await onFounderReply(requestId, message);
    } catch {
      /* best effort */
    }
  });
  return NextResponse.json({ ok: true });
}
