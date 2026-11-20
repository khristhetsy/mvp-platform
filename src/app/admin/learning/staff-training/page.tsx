import { redirect } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { getTrainingProgramId } from "@/lib/learning/course-access";

export const dynamic = "force-dynamic";

/** Training is a normal course now. Its access list lives in the course editor under Courses. */
export default async function AdminStaffTrainingRedirect() {
  await requireRole(["admin", "analyst"]);
  const id = await getTrainingProgramId();
  redirect(id ? `/admin/learning/courses/${id}` : "/admin/learning/courses");
}
