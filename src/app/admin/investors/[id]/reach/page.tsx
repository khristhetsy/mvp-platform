import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { resolveInvestorContact } from "@/lib/admin/investor-reach";
import { InvestorReachPanel } from "@/components/admin/investor-reach/InvestorReachPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Investor reach" };

/**
 * One investor's reach: every introduction and outreach email iCFO sent this
 * investor, from any founder, with delivery, opens and replies. The id is the
 * Investor Contact record, or a registered investor's profile id.
 */
export default async function InvestorReachPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const contact = await resolveInvestorContact(id);
  if (!contact) notFound();
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Investor reach" profileEmail={profile.email ?? undefined}>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-xs text-slate-500">
          <Link href="/admin/investors" className="hover:underline">Investors</Link> › Investor reach
        </p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold text-slate-900">
            {contact.name ?? contact.email ?? "Investor"}
            {contact.company ? <span className="font-normal text-slate-500"> · {contact.company}</span> : null}
          </h1>
          <Link href={`/admin/sales/contacts/${contact.id}`} className="text-[12.5px] font-semibold text-indigo-600 hover:underline">
            Open contact record
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-500">Everything iCFO sent this investor, from any founder: introductions, automated and manual outreach.</p>
        <div className="mt-5">
          <InvestorReachPanel contactId={contact.id} />
        </div>
      </div>
    </AppShell>
  );
}
