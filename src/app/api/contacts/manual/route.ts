import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { manualAddContact } from "@/lib/contacts/manualAdd";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email(),
  name: z.string().max(200).optional().nullable(),
  side: z.enum(["founder", "investor"]).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  website: z.string().max(300).optional().nullable(),
  note: z.string().max(4000).optional().nullable(),
});

// POST /api/contacts/manual — single hand-typed contact → crm_contacts.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  try {
    const result = await manualAddContact(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    const msg = err instanceof Error ? err.message : "Could not add contact.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
