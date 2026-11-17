import { CloudSenderTab } from "@/components/admin/linkedin/CloudSenderTab";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "LinkedIn" };

/** Admin › LinkedIn: campaigns and leads on the separate cloud sender. Staff only. */
export default async function AdminLinkedInPage() {
  await requireRole(["admin", "analyst"]);
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">LinkedIn</h1>
        <p className="mt-1 text-[13px] text-slate-500">Send LinkedIn invites from the cloud sender and follow who accepts and replies. Admin pilot.</p>
      </div>
      <CloudSenderTab />
    </div>
  );
}
