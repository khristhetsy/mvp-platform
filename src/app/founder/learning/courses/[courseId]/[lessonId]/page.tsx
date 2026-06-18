import { redirect } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { LessonPageClient } from "./LessonPageClient";

export const dynamic = "force-dynamic";

export default async function CapitalStageLessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const profile = await requireRole(["founder"]).catch(() => null);
  if (!profile) redirect("/auth/sign-in");

  return <LessonPageClient params={params} />;
}
