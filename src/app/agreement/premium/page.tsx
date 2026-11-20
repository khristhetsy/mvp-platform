import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { verifyAgreementLinkToken } from "@/lib/billing/agreement-link-core";
import { PremiumAgreementLinkForm } from "@/components/billing/PremiumAgreementLinkForm";

export const metadata: Metadata = { title: "Premium Services Agreement | iCapOS", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function Notice({ text }: Readonly<{ text: string }>) {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="text-sm leading-6 text-slate-600">{text}</p>
    </main>
  );
}

/** The page behind the Premium link an admin sends: review and accept the Services Agreement, then pay by card. */
export default async function PremiumAgreementPage({ searchParams }: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const token = one((await searchParams)?.t);
  const orgId = verifyAgreementLinkToken(token);
  if (!orgId) return <Notice text="This link is not valid. Please ask iCFO for a new one." />;

  const admin = createServiceRoleClient() as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await admin.from("organizations").select("conversion_plan, conversion_email, conversion_name").eq("id", orgId).eq("created_via", "admin_direct").maybeSingle();
  const org = data as { conversion_plan: string | null; conversion_email: string | null; conversion_name: string | null } | null;
  if (!org || org.conversion_plan !== "founder_premium" || !org.conversion_email) {
    return <Notice text="This link is no longer active. Please ask iCFO for a new one." />;
  }
  const { data: company } = await admin.from("companies").select("company_name").eq("org_id", orgId).order("created_at", { ascending: true }).limit(1).maybeSingle();

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Premium, $1,500 per month</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Accept your Services Agreement</h1>
        <div className="mt-5">
          <PremiumAgreementLinkForm
            token={token}
            email={org.conversion_email}
            name={org.conversion_name}
            company={(company as { company_name: string | null } | null)?.company_name ?? null}
          />
        </div>
      </div>
    </main>
  );
}
