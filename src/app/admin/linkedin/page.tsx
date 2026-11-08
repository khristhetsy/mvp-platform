import { LinkedInClient } from "@/components/admin/linkedin/LinkedInClient";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "LinkedIn" };

/** Admin › LinkedIn outreach (admin pilot). Staff only. */
export default async function AdminLinkedInPage() {
  await requireRole(["admin", "analyst"]);
  return <LinkedInClient />;
}
