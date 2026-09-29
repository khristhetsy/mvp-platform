import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { SentEmailsClient } from "@/components/admin/activity/SentEmailsClient";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ role?: string; q?: string; user?: string }>;

export default async function SentEmailsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole(["admin", "analyst"]);
  const params = await searchParams;
  return (
    <AppShell>
      <div className="space-y-4">
        <Link href="/admin/activity" className="text-xs text-indigo-600 hover:underline">
          ← Account activity
        </Link>
        <SentEmailsClient initialRole={params.role ?? null} initialQuery={params.q ?? ""} userId={params.user ?? null} />
      </div>
    </AppShell>
  );
}
