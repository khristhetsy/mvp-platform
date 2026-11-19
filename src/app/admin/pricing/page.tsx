import { AppShell } from "@/components/AppShell";
import PricingAdminClient from "@/components/admin/pricing/PricingAdminClient";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing" };

export default async function AdminPricingPage() {
  const profile = await requireRole(["admin", "analyst"]);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Pricing"
      profileEmail={profile.email ?? undefined}
    >
      <div className="mb-6 border-b border-slate-200 px-1 pb-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Admin workspace</p>
        <h1 className="mt-0.5 text-[22px] font-medium tracking-tight text-slate-950">Pricing</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          One place that decides what every screen says a plan costs. New card customers are charged through Stripe, using the price ids set in Vercel. Older subscribers still on Lemon Squeezy keep the price they pay now.
        </p>
      </div>

      <PricingAdminClient canEdit={profile.role === "admin"} />
    </AppShell>
  );
}
