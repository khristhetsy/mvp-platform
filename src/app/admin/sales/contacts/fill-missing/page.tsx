import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { guessableFields } from "@/lib/contacts/fill-missing";
import { FillMissingClient } from "./FillMissingClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fill missing fields" };

export default async function FillMissingPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const fields = {
    founder: guessableFields("founder").map((f) => ({ field: f.field, label: f.label, default: f.guess!.default })),
    investor: guessableFields("investor").map((f) => ({ field: f.field, label: f.label, default: f.guess!.default })),
  };
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Fill missing fields" profileEmail={profile.email ?? undefined}>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="text-[12px] text-[var(--text-muted)]"><Link href="/admin/sales/contacts" className="hover:underline">Contacts</Link> · Fill missing fields</div>
        <h1 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Fill missing fields</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Fills blank founder and investor profile fields from the contact&rsquo;s own data, then their website, then same-type statistics. Each step is previewed first, never overwrites a value the contact has, and tags every value so it shows as filled rather than stated and can be undone.</p>
        <div className="mt-5"><FillMissingClient fields={fields} /></div>
      </div>
    </AppShell>
  );
}
