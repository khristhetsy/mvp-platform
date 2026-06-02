import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireStaffApi } from "@/lib/api/admin";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function fallbackSummary(input: {
  roomTitle: string;
  unresolvedQuestions: number;
  unresolvedDocs: number;
}) {
  return [
    `Deal room: ${input.roomTitle}`,
    `Unresolved questions: ${input.unresolvedQuestions}`,
    `Unresolved document requests: ${input.unresolvedDocs}`,
    "Educational / diligence collaboration only. No legal or investment advice.",
  ].join("\n");
}

export async function GET(_: Request, { params }: Readonly<{ params: Promise<{ roomId: string }> }>) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const { roomId } = await params;
  const admin = createServiceRoleClient();

  const [{ data: room }, { data: questions }, { data: docs }] = await Promise.all([
    admin.from("deal_rooms").select("id, title").eq("id", roomId).maybeSingle(),
    admin
      .from("deal_room_questions")
      .select("category, question, status, founder_response")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("deal_room_document_requests")
      .select("request_type, custom_request, status, founder_note")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (!room) return NextResponse.json({ error: "Deal room not found." }, { status: 404 });

  const unresolvedQuestions = (questions ?? []).filter((q) => q.status !== "resolved").length;
  const unresolvedDocs = (docs ?? []).filter((d) => d.status !== "fulfilled" && d.status !== "cancelled").length;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({
      summary: fallbackSummary({ roomTitle: room.title, unresolvedQuestions, unresolvedDocs }),
      mode: "fallback",
    });
  }

  const client = new OpenAI({ apiKey });
  const prompt = [
    "You summarize a private deal-room diligence workspace for admin oversight.",
    "STRICT RULES:",
    "- No legal, tax, securities, or investment advice.",
    "- No funding promises or commitment language.",
    "- Do not invent facts not present in inputs.",
    "- Focus on unresolved concerns, themes, and next steps.",
    "",
    `Room: ${room.title}`,
    "",
    "Questions:",
    ...(questions ?? []).map((q) => `- [${q.category}] (${q.status}) Q: ${q.question}${q.founder_response ? ` | A: ${q.founder_response}` : ""}`),
    "",
    "Document requests:",
    ...(docs ?? []).map((d) => `- [${d.request_type}] (${d.status}) ${d.custom_request ?? ""}${d.founder_note ? ` | note: ${d.founder_note}` : ""}`),
  ].join("\n");

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You produce concise compliance-safe summaries." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 350,
  });

  const summary = completion.choices[0]?.message?.content?.trim() || fallbackSummary({ roomTitle: room.title, unresolvedQuestions, unresolvedDocs });

  return NextResponse.json({ summary, mode: "openai" });
}

