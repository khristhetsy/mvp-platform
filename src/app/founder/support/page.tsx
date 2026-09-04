import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listFounderRequests } from "@/lib/support/support";
import { getJourneyOverview } from "@/lib/founder/stage-gate-status";
import { FounderSupportClient, type FounderRequestRow } from "@/components/founder/FounderSupportClient";
import { FounderSupportAssistant } from "@/components/founder/FounderSupportAssistant";
import { RequestHelpButton } from "@/components/founder/RequestHelpButton";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support" };

const BROWSE = [
  { href: "/founder/help", icon: "ti-book-2", title: "Stage guides", desc: "Step-by-step for each stage of your raise." },
  { href: "/founder/learning", icon: "ti-compass", title: "Learning", desc: "Courses and lessons for your round." },
  { href: "/founder/settings/billing", icon: "ti-credit-card", title: "Billing & plan", desc: "Manage your plan and subscription." },
];

export default async function FounderSupportPage() {
  const profile = await requireRole(["founder"]);
  const supabase = await createServerSupabaseClient();

  const [requests, journey] = await Promise.all([
    listFounderRequests(supabase, profile.id),
    getJourneyOverview(supabase as unknown as SupabaseClient<Database>, profile.id).catch(() => null),
  ]);

  const rows: FounderRequestRow[] = requests.map((r) => ({
    id: r.id,
    subject: r.subject,
    status: r.status,
    contextItem: r.context_item,
    csat: r.csat,
    createdAt: r.created_at,
  }));

  const founderName = profile.full_name ?? profile.email ?? "Founder";

  return (
    <FounderAppShell profileName={founderName} profileSubtitle="Support">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          eyebrow="Help"
          title="Support"
          description="Ask the iCapOS assistant, browse a guide, or reach the team."
        />
        <RequestHelpButton contextItem="Support" />
      </div>

      <div className="mt-2">
        <FounderSupportAssistant founderName={founderName} stageSlug={journey?.currentSlug ?? null} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-slate-700">Browse on your own</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BROWSE.map((b) => (
            <Link
              key={b.href}
              href={b.href}
              className="group rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-indigo-300 hover:bg-indigo-50/30"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <i className={`ti ${b.icon} text-[17px]`} aria-hidden="true" />
              </div>
              <p className="mt-2.5 text-[13px] font-medium text-slate-900">{b.title}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">{b.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {rows.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-slate-700">Your requests</h2>
          <FounderSupportClient rows={rows} />
        </section>
      ) : null}
    </FounderAppShell>
  );
}
