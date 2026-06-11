import { redirect } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";

export default async function AdminDiligencePage() {
  await requireRole(["admin", "analyst"]);
  redirect("/admin/reports");
}
