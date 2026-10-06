import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { SalesHubHeader } from "../../SalesHubHeader";
import { ProfileFillClient } from "./ProfileFillClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review profile fill" };

/** One LinkedIn contact at a time: AI drafted bio, company summary and labelled guesses to accept or reject. */
export default async function ProfileFillPage() {
  const profile = await requireRole(["admin", "analyst"]);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <div className="mx-auto max-w-5xl px-4 py-5">
        <div className="text-[12px] text-[var(--text-muted)]">
          <Link href="/admin/sales/contacts" className="hover:underline">Contacts</Link> ·{" "}
          <Link href="/admin/sales/contacts/linkedin-import?step=enrich" className="hover:underline">Import LinkedIn connections</Link> · Review profile fill
        </div>
        <ProfileFillClient />
      </div>
    </AppShell>
  );
}
