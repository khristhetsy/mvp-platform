import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import {
  getPublishedAdminCourseBySlug,
  listPublishedAdminCourseModules,
  listPublishedAdminLessonsForModule,
} from "@/lib/learning/admin-courses";

export async function GET(request: Request) {
  try {
    await requireRole(["founder"]);
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    if (!slug) return NextResponse.json({ course: null }, { status: 200 });

    const course = await getPublishedAdminCourseBySlug(slug);
    if (!course) return NextResponse.json({ course: null }, { status: 200 });

    const modules = await listPublishedAdminCourseModules(course.id);
    const modulesWithLessons = await Promise.all(
      modules.map(async (mod) => {
        const lessons = await listPublishedAdminLessonsForModule(mod.slug);
        return { ...mod, lessons };
      }),
    );

    return NextResponse.json({ course, modules: modulesWithLessons });
  } catch {
    return NextResponse.json({ course: null }, { status: 200 });
  }
}
