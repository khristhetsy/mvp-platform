import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { voiceOutboundEnabled } from "@/lib/voice/gate";
import { voiceWebhookAuthorized } from "@/lib/voice/webhook-auth";
import { runAgentTurn } from "@/lib/voice/agent";

export const dynamic = "force-dynamic";

// OpenAI-compatible Custom-LLM endpoint for Vapi. Vapi POSTs an OpenAI
// chat/completions request each turn (to `{customLlmUrl}/chat/completions`),
// carrying the call metadata + variableValues. We pull the guardrailed reply
// from runAgentTurn and return it as an OpenAI completion (streaming or not).
// Guarded by the kill-switch + shared secret, same as the other voice webhooks.

/* eslint-disable @typescript-eslint/no-explicit-any */

function metaFrom(body: any): Record<string, any> {
  return {
    ...(body?.metadata ?? {}),
    ...(body?.call?.metadata ?? {}),
    ...(body?.call?.assistantOverrides?.metadata ?? {}),
    ...(body?.call?.assistantOverrides?.variableValues ?? {}),
    ...(body?.assistantOverrides?.variableValues ?? {}),
  };
}

async function audienceFor(contactId: string): Promise<"founder" | "investor"> {
  if (!contactId) return "founder";
  try {
    const db = createServiceRoleClient() as unknown as SupabaseClient;
    const { data } = await db.from("crm_contacts").select("module").eq("source", "odoo").eq("external_id", contactId).maybeSingle();
    return (data as { module?: string } | null)?.module === "investor" ? "investor" : "founder";
  } catch {
    return "founder";
  }
}

function openAiJson(reply: string) {
  return {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "icapos-voice-agent",
    choices: [{ index: 0, message: { role: "assistant", content: reply }, finish_reason: "stop" }],
  };
}

function streamOpenAi(reply: string): Response {
  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  const chunk = (delta: Record<string, unknown>, finish: string | null) =>
    `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model: "icapos-voice-agent", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
  const body = chunk({ role: "assistant", content: reply }, null) + chunk({}, "stop") + "data: [DONE]\n\n";
  return new Response(body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!voiceOutboundEnabled()) return NextResponse.json({ error: "Voice outbound is disabled." }, { status: 503 });
  if (!voiceWebhookAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as any;
  try {
    const md = metaFrom(body);
    const contactId = String(md.contactId ?? md.contact_id ?? "");
    const audience = md.audience === "investor" || md.audience === "founder" ? md.audience : await audienceFor(contactId);

    // OpenAI messages → our {role, content}; drop system (we build the guardrail).
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m: any) => m?.role === "user" || m?.role === "assistant")
      .map((m: any) => ({ role: m.role as "user" | "assistant", content: typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.map((c: any) => c?.text ?? "").join(" ") : "" }))
      .filter((m: any) => m.content);
    if (messages.length === 0) messages.push({ role: "user", content: "(call connected)" });

    const result = await runAgentTurn({
      contactId,
      audience,
      contactName: md.contactName ?? body?.call?.customer?.name ?? null,
      openerScript: md.opener ?? null,
      phone: body?.call?.customer?.number ?? null,
      messages,
    });

    const reply = result.reply || "One moment.";
    return body?.stream ? streamOpenAi(reply) : NextResponse.json(openAiJson(reply));
  } catch (err) {
    Sentry.captureException(err);
    // Return a safe spoken fallback rather than erroring the call.
    const fallback = "I'm going to have a member of the iCFO team follow up with you directly. Thanks for your time.";
    return body?.stream ? streamOpenAi(fallback) : NextResponse.json(openAiJson(fallback));
  }
}
