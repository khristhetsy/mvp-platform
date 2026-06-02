import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLearningStaff, jsonBadRequest } from "@/app/api/admin/learning/_shared";

const quizUpdateSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  passing_score: z.number().int().min(0).max(100).optional(),
  retry_limit: z.number().int().min(0).max(50).optional().nullable(),
  content_status: z.enum(["draft", "pending_review", "approved", "published", "archived"]).optional(),
});

export async function GET(_: Request, { params }: Readonly<{ params: Promise<{ quizId: string }> }>) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;
  const { quizId } = await params;

  const { data: quiz, error: quizError } = await auth.supabase.from("learning_quizzes").select("*").eq("id", quizId).maybeSingle();
  if (quizError) return jsonBadRequest(quizError);

  const { data: questions, error: qError } = await auth.supabase
    .from("learning_quiz_questions")
    .select("id, quiz_id, order_index, prompt, options, correct_option_index, updated_at")
    .eq("quiz_id", quizId)
    .order("order_index", { ascending: true })
    .limit(200);

  if (qError) return jsonBadRequest(qError);
  return NextResponse.json({ quiz, questions: questions ?? [] });
}

export async function PATCH(request: Request, { params }: Readonly<{ params: Promise<{ quizId: string }> }>) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;
  const { quizId } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = quizUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const patch = { ...parsed.data, updated_by: auth.profile.id, updated_at: new Date().toISOString() };
  const { data, error } = await auth.supabase.from("learning_quizzes").update(patch).eq("id", quizId).select("*").single();
  if (error) return jsonBadRequest(error);
  return NextResponse.json({ quiz: data });
}

