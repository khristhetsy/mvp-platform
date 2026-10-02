import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/auth";
import { setTestimonialStatus } from "@/lib/testimonials/db";

const STATUSES = new Set(["pending", "approved", "declined"]);

/** Approve, decline or reset a founder testimonial. Admin only. */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const profile = await requireRole(["admin"]);
    const { id, status } = (await req.json()) as { id?: string; status?: string };
    if (!id || !status || !STATUSES.has(status)) {
      return NextResponse.json({ error: "id and a valid status are required." }, { status: 400 });
    }
    await setTestimonialStatus(id, status as "pending" | "approved" | "declined", profile.id);
    // The homepage section reads approved rows; refresh it now rather than at the next hourly revalidate.
    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
