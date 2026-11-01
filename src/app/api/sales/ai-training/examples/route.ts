import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { addExample, removeExample, TrainingError } from "@/lib/sales-ai/training-store";
import { MAX_EXAMPLE_CHARS, MIN_EXAMPLE_CHARS } from "@/lib/sales-ai/training-types";

export const dynamic = "force-dynamic";

async function staff() {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return { error: auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { profile: auth.profile };
}

const schema = z.object({
  kind: z.enum(["send", "never"]),
  stageName: z.string().trim().max(60).nullable().optional(),
  body: z.string().trim().min(MIN_EXAMPLE_CHARS, "Paste the whole email.").max(MAX_EXAMPLE_CHARS, "Keep an example under 3,000 characters."),
  reason: z.string().trim().max(200, "Keep the reason under 200 characters.").nullable().optional(),
});

// POST: add an example email. A "never send" example needs a one line reason.
export async function POST(req: Request): Promise<Response> {
  const a = await staff();
  if (a.error) return a.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const { kind, body } = parsed.data;
  const reason = parsed.data.reason?.trim() || null;
  if (kind === "never" && !reason) return NextResponse.json({ error: "Say in one line why this email must never be sent." }, { status: 400 });
  try {
    const example = await addExample({ kind, stageName: parsed.data.stageName?.trim() || null, body, reason }, a.profile.id);
    return NextResponse.json({ example });
  } catch (err) {
    if (err instanceof TrainingError) return NextResponse.json({ error: err.message }, { status: 400 });
    return NextResponse.json({ error: "Could not save the example." }, { status: 500 });
  }
}

// DELETE: remove an example.
export async function DELETE(req: Request): Promise<Response> {
  const a = await staff();
  if (a.error) return a.error;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  if (!(await removeExample(id))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
