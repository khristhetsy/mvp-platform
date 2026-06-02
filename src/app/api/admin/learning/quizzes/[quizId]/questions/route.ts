import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLearningStaff, jsonBadRequest } from "@/app/api/admin/learning/_shared";

const questionSchema = z.object({
  id: z.string().uuid().optional(),
  order_index: z.number().int().optional().default(0),
  prompt: z.string().min(3).max(5000),
  options: z.array(z.string().min(1).max(500)).min(2).max(10),
  correct_option_index: z.number().int().min(0).max(9).default(0),
  explanation: z.string().max(2000).optional().nullable(),
});

const upsertSchema = z.object({
  questions: z.array(questionSchema).min(1),
});

export async function POST(request: Request, { params }: Readonly<{ params: Promise<{ quizId: string }> }>) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;
  const { quizId } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = questionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const payload = {
    quiz_id: quizId,
    order_index: parsed.data.order_index ?? 0,
    prompt: parsed.data.prompt,
    options: parsed.data.options,
    correct_option_index: parsed.data.correct_option_index,
    explanation: parsed.data.explanation ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await auth.supabase.from("learning_quiz_questions").insert(payload).select("*").single();
  if (error) return jsonBadRequest(error);
  return NextResponse.json({ question: data });
}

export async function PUT(request: Request, { params }: Readonly<{ params: Promise<{ quizId: string }> }>) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;
  const { quizId } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updates = parsed.data.questions.map((q) => ({
    id: q.id,
    quiz_id: quizId,
    order_index: q.order_index ?? 0,
    prompt: q.prompt,
    options: q.options,
    correct_option_index: q.correct_option_index,
    explanation: q.explanation ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await auth.supabase
    .from("learning_quiz_questions")
    .upsert(updates, { onConflict: "id" })
    .select("*");
  if (error) return jsonBadRequest(error);
  return NextResponse.json({ questions: data ?? [] });
}

export async function DELETE(request: Request, { params }: Readonly<{ params: Promise<{ quizId: string }> }>) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;
  const { quizId } = await params;

  const url = new URL(request.url);
  const questionId = url.searchParams.get("questionId");
  if (!questionId) return NextResponse.json({ error: "questionId is required." }, { status: 400 });

  const { error } = await auth.supabase
    .from("learning_quiz_questions")
    .delete()
    .eq("quiz_id", quizId)
    .eq("id", questionId);
  if (error) return jsonBadRequest(error);
  return NextResponse.json({ ok: true });
}

