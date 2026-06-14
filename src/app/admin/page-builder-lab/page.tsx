import { redirect } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

/**
 * Page Builder Lab — coming soon.
 * Redirects to admin dashboard until the lab feature is built.
 */
export default async function PageBuilderLabPage() {
  await requireRole(["admin"]);
  redirect("/admin/dashboard");
}
