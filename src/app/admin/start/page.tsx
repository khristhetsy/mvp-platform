import { redirect } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { getAdminHomeSettings } from "@/lib/settings/admin-home";
import { adminStartPath } from "@/lib/settings/admin-home-shape";

export const dynamic = "force-dynamic";

/** Where admins land after signing in: the Home grid or the Dashboard, as set company-wide by a super admin. */
export default async function AdminStartPage() {
  await requireRole(["admin", "analyst"]);
  redirect(adminStartPath(await getAdminHomeSettings()));
}
