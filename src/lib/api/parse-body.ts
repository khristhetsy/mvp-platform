import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { z } from "zod";

/**
 * Parse and validate a JSON request body against a zod schema. Returns either the
 * typed data or a ready-to-return 400 response — standardizing the body-validation
 * boundary across API routes (audit H7).
 *
 * Usage:
 *   const parsed = await parseJsonBody(req, schema);
 *   if (parsed.error) return parsed.error;
 *   const { field } = parsed.data;
 */
export async function parseJsonBody<T extends z.ZodTypeAny>(
  req: NextRequest,
  schema: T,
): Promise<{ data: z.infer<T>; error?: undefined } | { data?: undefined; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 }) };
  }
  return { data: parsed.data };
}
