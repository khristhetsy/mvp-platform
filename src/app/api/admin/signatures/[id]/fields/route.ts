import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getRequestById } from "@/lib/esignature/requests";
import { replaceFields } from "@/lib/esignature/fields";

export const dynamic = "force-dynamic";

const fieldSchema = z.object({
  field_type: z.enum(["signature", "date", "company", "text", "initial"]),
  page: z.number().int().min(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
  required: z.boolean().optional(),
  placeholder: z.string().max(120).nullish(),
});

const putSchema = z.object({ fields: z.array(fieldSchema).max(200) });

/** PUT — replace the placed-field set for an envelope (only while editable). */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("review_documents");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const request = await getRequestById(auth.supabase, id);
  if (!request || request.created_by !== auth.userId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  // Fields are only editable before the envelope leaves the admin's hands.
  if (request.status !== "draft") {
    return NextResponse.json({ error: "Fields can only be edited on a draft envelope." }, { status: 409 });
  }

  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid field data." }, { status: 400 });
  }

  const fields = await replaceFields(auth.supabase, id, parsed.data.fields);
  return NextResponse.json({ fields });
}
