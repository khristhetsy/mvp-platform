import { NextResponse } from "next/server";
import { isClaudeConfigured } from "@/lib/claude";
import { requireApiProfile } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { suggestedPromptChips } from "@/lib/assistant/assistant-actions";
import { modeIntroLabel } from "@/lib/assistant/assistant-prompts";
import { ASSISTANT_DISCLAIMER, ASSISTANT_SAFETY_NOTES } from "@/lib/assistant/assistant-policy";
import { inferAssistantMode } from "@/lib/assistant/assistant-context";
import { loadAssistantContextForProfile, runAssistantChat } from "@/lib/assistant/assistant-response";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { assistantChatSchema } from "@/lib/validation";

function roleFromProfile(role: string): "founder" | "investor" | "admin" | "analyst" {
  if (role === "investor") return "investor";
  if (role === "admin") return "admin";
  if (role === "analyst") return "analyst";
  return "founder";
}

export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;

  const rateLimited = await enforceRateLimit({
    bucket: "assistant-chat",
    subjectId: auth.profile.id,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => ({}));
  const parsed = assistantChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid assistant request." }, { status: 400 });
  }

  const profileRole = roleFromProfile(auth.profile.role);
  const mode =
    parsed.data.mode ??
    inferAssistantMode({
      role: profileRole,
      currentPath: parsed.data.currentPath,
    });

  if (parsed.data.intent === "opened") {
    emitOperationalEvent(createServiceRoleClient(), {
      eventType: "assistant_opened",
      eventCategory: "system",
      entityType: "assistant",
      entityId: auth.profile.id,
      actorUserId: auth.profile.id,
      actorRole: auth.profile.role,
      severity: "info",
      title: "Assistant opened",
      description: `Assistant opened in ${mode} mode.`,
      metadata: {
        mode,
        path: parsed.data.currentPath ?? null,
      },
      sourceModule: "assistant",
      visibility: "admin_only",
      dedupeKey: `assistant_opened:${auth.profile.id}:${parsed.data.currentPath ?? "root"}`,
      dedupeWindowMinutes: 5,
    });

    const ctx = await loadAssistantContextForProfile(auth.profile, auth.supabase, parsed.data);
    return NextResponse.json({
      answer: modeIntroLabel(mode, profileRole),
      suggestedActions: [],
      relatedLinks: [],
      safetyNotes: [ASSISTANT_DISCLAIMER, ...ASSISTANT_SAFETY_NOTES],
      contextUsed: [],
      mode,
      provider: "fallback",
      suggestedPrompts: suggestedPromptChips(ctx),
      claudeAvailable: isClaudeConfigured(),
    });
  }

  const message = parsed.data.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const response = await runAssistantChat({
    profile: auth.profile,
    supabase: auth.supabase,
    request: { ...parsed.data, message },
  });

  emitOperationalEvent(createServiceRoleClient(), {
    eventType: "assistant_question_asked",
    eventCategory: "system",
    entityType: "assistant",
    entityId: auth.profile.id,
    actorUserId: auth.profile.id,
    actorRole: auth.profile.role,
    severity: "info",
    title: "Assistant question asked",
    description: `Assistant used in ${response.mode} mode.`,
    metadata: {
      mode: response.mode,
      provider: response.provider,
      path: parsed.data.currentPath ?? null,
    },
    sourceModule: "assistant",
    visibility: "admin_only",
    dedupeKey: `assistant_question:${auth.profile.id}:${message.slice(0, 40).toLowerCase()}`,
    dedupeWindowMinutes: 2,
  });

  return NextResponse.json({
    ...response,
    claudeAvailable: isClaudeConfigured(),
  });
}
