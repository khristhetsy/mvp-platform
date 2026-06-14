import { redirect } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminDiligencePage() {
  await requireRole(["admin", "analyst"]);
  redirect("/admin/reports");
}
