import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ensureCanIssueCertificates,
  ensureCanPublish,
  jsonBadRequest,
  requireLearningStaff,
} from "@/app/api/admin/learning/_shared";

const contentTypeSchema = z.enum(["program", "module", "lesson", "quiz"]);

const actionSchema = z.object({
  contentType: contentTypeSchema,
  contentId: z.string().uuid(),
  action: z.enum(["approve", "publish", "unpublish", "archive", "request_review"]),
  notes: z.string().max(2000).optional(),
});

function tableForType(type: z.infer<typeof contentTypeSchema>) {
  switch (type) {
    case "program":
      return "learning_programs";
    case "module":
      return "learning_modules";
    case "lesson":
      return "learning_lessons";
    case "quiz":
      return "learning_quizzes";
  }
}

function nextStatus(action: string) {
  if (action === "request_review") return "pending_review";
  if (action === "approve") return "approved";
  if (action === "publish") return "published";
  if (action === "archive") return "archived";
  if (action === "unpublish") return "approved";
  return null;
}

export async function POST(request: Request) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;

  const body = await request.json().catch(() => ({}));
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { contentType, contentId, action, notes } = parsed.data;

  if (action === "publish" || action === "unpublish" || action === "approve" || action === "archive") {
    ensureCanPublish(auth.profile);
  }

  if (action === "publish" && contentType === "program") {
    // Certificates issuance is separate; no auto-issued certs in Phase 1.
    ensureCanIssueCertificates(auth.profile);
  }

  const table = tableForType(contentType);
  const desired = nextStatus(action);
  if (!desired) return NextResponse.json({ error: "Invalid action." }, { status: 400 });

  const { data: current, error: currentError } = await auth.supabase
    .from(table)
    .select("content_status, is_published")
    .eq("id", contentId)
    .maybeSingle();

  if (currentError) return jsonBadRequest(currentError);
  if (!current) return NextResponse.json({ error: "Content not found." }, { status: 404 });

  const patch: Record<string, unknown> = {
    content_status: desired,
    updated_at: new Date().toISOString(),
  };

  if (contentType === "program" || contentType === "module") {
    if (action === "publish") patch.is_published = true;
    if (action === "unpublish") patch.is_published = false;
  }

  const { data: updated, error: updateError } = await auth.supabase
    .from(table)
    .update(patch)
    .eq("id", contentId)
    .select("*")
    .single();

  if (updateError) return jsonBadRequest(updateError);

  const currentStatus =
    current && typeof current === "object" && "content_status" in current ? String((current as { content_status?: unknown }).content_status ?? "") : "";

  await auth.supabase.from("learning_content_approvals").insert({
    content_type: contentType,
    content_id: contentId,
    from_status: currentStatus,
    to_status: desired,
    reviewer_id: auth.profile.id,
    notes: notes?.trim() ? notes.trim() : null,
  });

  return NextResponse.json({ content: updated });
}

