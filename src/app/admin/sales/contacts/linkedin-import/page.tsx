import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { SalesHubHeader } from "../../SalesHubHeader";
import { LinkedinImportClient } from "./LinkedinImportClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import LinkedIn connections" };

export default async function LinkedinImportPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { step } = await searchParams;
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <div className="mx-auto max-w-6xl px-4 py-5">
        <div className="text-[12px] text-[var(--text-muted)]"><Link href="/admin/sales/contacts" className="hover:underline">Contacts</Link> · Import LinkedIn connections</div>
        <LinkedinImportClient initialStep={step === "enrich" ? "enrich" : "upload"} />
      </div>
    </AppShell>
  );
}
