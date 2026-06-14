import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    await requireRole(["admin", "analyst"]);
    const { founderId, companyId, adminName, toAssign, toRemove } = (await request.json()) as {
      founderId: string;
      companyId: string;
      adminName: string;
      toAssign: Array<{ moduleSlug: string; lessonId: string; lessonTitle: string }>;
      toRemove: Array<{ moduleSlug: string; lessonId: string }>;
    };

    if (!founderId || !companyId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = admin as any;

    // Add new assignments
    if (toAssign.length > 0) {
      await db.from("admin_lesson_assignments").upsert(
        toAssign.map((a) => ({
          founder_id: founderId,
          company_id: companyId,
          module_slug: a.moduleSlug,
          lesson_id: a.lessonId,
          lesson_title: a.lessonTitle,
          assigned_by: adminName,
          assigned_at: new Date().toISOString(),
        })),
        { onConflict: "founder_id,company_id,module_slug,lesson_id" },
      );
    }

    // Remove unassigned
    for (const r of toRemove) {
      await db
        .from("admin_lesson_assignments")
        .delete()
        .eq("founder_id", founderId)
        .eq("company_id", companyId)
        .eq("module_slug", r.moduleSlug)
        .eq("lesson_id", r.lessonId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/learning/lesson-assignments]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
