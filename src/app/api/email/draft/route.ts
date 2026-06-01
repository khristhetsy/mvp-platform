import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeUserRole } from "@/lib/api/admin";
import { buildEmailDraft } from "@/lib/email/draft-builder";
import { EMAIL_TEMPLATE_TYPES } from "@/lib/email/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

const draftRequestSchema = z.object({
  templateType: z.enum(EMAIL_TEMPLATE_TYPES),
  entityType: z.string().max(64).optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  recipient: z.string().email().optional().nullable(),
  context: z.record(z.string(), z.unknown()).optional(),
  sourceActionId: z.string().uuid().optional().nullable(),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: profileRaw, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profileRaw) {
    return NextResponse.json({ error: "Profile not found." }, { status: 401 });
  }

  const role = normalizeUserRole(profileRaw.role);
  if (!role) {
    return NextResponse.json({ error: "Invalid role." }, { status: 403 });
  }

  const profile = { ...(profileRaw as Profile), role };

  const body = await request.json().catch(() => null);
  const parsed = draftRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid draft request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const result = await buildEmailDraft(supabase, profile, {
    templateType: parsed.data.templateType,
    entityType: parsed.data.entityType ?? null,
    entityId: parsed.data.entityId ?? null,
    recipient: parsed.data.recipient ?? null,
    context: parsed.data.context,
    sourceActionId: parsed.data.sourceActionId ?? null,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    draft: result.draft,
    safetyNotes: result.draft.safetyNotes,
    suggestedRecipients: result.suggestedRecipients,
    auditId: result.auditId,
    sent: false,
  });
}
