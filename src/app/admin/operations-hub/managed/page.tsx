import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getActingCapability } from "@/lib/admin/act-on-behalf";
import { canOpenAsFounder } from "@/lib/team/account-manager-core";
import { MANAGED_ICFO_ROLE } from "@/lib/team/managed-icfo-core";
import { OpsHubTabs } from "../OpsHubTabs";
import { OpenAsFounderButton } from "@/components/admin/OpenAsFounderButton";

export const dynamic = "force-dynamic";

type Row = {
  companyId: string;
  company: string;
  founderId: string;
  founder: string;
  managerId: string | null;
  manager: string | null;
  renews: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return createServiceRoleClient();
}

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

/** Premium, Done for you accounts, with their account manager and a one click way in. */
export default async function ManagedAccountsPage({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const mineOnly = (await searchParams)?.who === "mine";
  const cap = await getActingCapability();

  const { data: subs } = await db()
    .from("subscriptions")
    .select("profile_id, current_period_end")
    .eq("plan_type", "founder_premium")
    .eq("subscription_status", "active");
  const premium = (subs ?? []) as Array<{ profile_id: string; current_period_end: string | null }>;
  const founderIds = premium.map((s) => s.profile_id);

  let rows: Row[] = [];
  if (founderIds.length) {
    const [{ data: companies }, { data: founders }] = await Promise.all([
      db().from("companies").select("id, company_name, founder_id, created_at").in("founder_id", founderIds).order("created_at", { ascending: true }),
      db().from("profiles").select("id, full_name, email").in("id", founderIds),
    ]);
    // One row per founder: their primary (oldest) company.
    const primary = new Map<string, { id: string; company_name: string | null }>();
    for (const c of (companies ?? []) as Array<{ id: string; company_name: string | null; founder_id: string }>) {
      if (!primary.has(c.founder_id)) primary.set(c.founder_id, c);
    }
    const companyIds = [...primary.values()].map((c) => c.id);
    const { data: members } = companyIds.length
      ? await db().from("company_members").select("company_id, user_id").eq("role", MANAGED_ICFO_ROLE).in("company_id", companyIds)
      : { data: [] };
    const managerByCompany = new Map<string, string>();
    for (const m of (members ?? []) as Array<{ company_id: string; user_id: string }>) {
      if (!managerByCompany.has(m.company_id)) managerByCompany.set(m.company_id, m.user_id);
    }
    const managerIds = [...new Set(managerByCompany.values())];
    const { data: staff } = managerIds.length ? await db().from("profiles").select("id, full_name, email").in("id", managerIds) : { data: [] };
    const nameOf = new Map<string, string>();
    for (const p of [...(founders ?? []), ...(staff ?? [])] as Array<{ id: string; full_name: string | null; email: string | null }>) {
      nameOf.set(p.id, p.full_name ?? p.email ?? "Unknown");
    }

    rows = premium
      .map((s) => {
        const company = primary.get(s.profile_id);
        if (!company) return null;
        const managerId = managerByCompany.get(company.id) ?? null;
        return {
          companyId: company.id,
          company: company.company_name ?? "Company",
          founderId: s.profile_id,
          founder: nameOf.get(s.profile_id) ?? "Founder",
          managerId,
          manager: managerId ? (nameOf.get(managerId) ?? "Unknown") : null,
          renews: s.current_period_end,
        } satisfies Row;
      })
      .filter((r): r is Row => r !== null)
      .filter((r) => (mineOnly ? r.managerId === profile.id : true))
      .sort((a, b) => a.company.localeCompare(b.company));
  }

  const tab = (href: string, label: string, active: boolean) => (
    <Link href={href} style={{ fontSize: 12, padding: "5px 12px", textDecoration: "none", background: active ? "#EFF6FF" : "#fff", color: active ? "#1A6CE4" : "var(--muted-foreground)", fontWeight: active ? 500 : 400 }}>{label}</Link>
  );
  const unassigned = rows.filter((r) => !r.managerId).length;

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4338CA" }}>Admin Workspace</p>
        <h1 style={{ marginTop: 6, fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--foreground)" }}>Operations</h1>
      </div>
      <OpsHubTabs />

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, overflow: "hidden" }}>
          {tab("/admin/operations-hub/managed", "All Premium accounts", !mineOnly)}
          <span style={{ borderLeft: "0.5px solid var(--border-strong, #cbd5e1)" }} />
          {tab("/admin/operations-hub/managed?who=mine", "Mine", mineOnly)}
        </div>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          {rows.length} account{rows.length === 1 ? "" : "s"}
          {unassigned > 0 && !mineOnly ? `, ${unassigned} without an account manager` : ""}
        </span>
        {!cap.available ? (
          <span style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>Open as founder is switched off.</span>
        ) : null}
      </div>

      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#f8fafc", textAlign: "left", color: "var(--muted-foreground)" }}>
              <th style={{ padding: "10px 14px", fontWeight: 600 }}>Company</th>
              <th style={{ padding: "10px 14px", fontWeight: 600 }}>Founder</th>
              <th style={{ padding: "10px 14px", fontWeight: 600 }}>Account manager</th>
              <th style={{ padding: "10px 14px", fontWeight: 600 }}>Renews</th>
              <th style={{ padding: "10px 14px", fontWeight: 600 }} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 18, color: "var(--muted-foreground)" }}>{mineOnly ? "No Premium accounts are assigned to you yet." : "No active Premium accounts yet."}</td></tr>
            ) : rows.map((r) => (
              <tr key={r.companyId} style={{ borderTop: "0.5px solid #eef1f5" }}>
                <td style={{ padding: "10px 14px" }}><Link href={`/admin/companies/${r.companyId}`} style={{ color: "#185FA5", textDecoration: "none", fontWeight: 600 }}>{r.company}</Link></td>
                <td style={{ padding: "10px 14px" }}>{r.founder}</td>
                <td style={{ padding: "10px 14px", color: r.manager ? "inherit" : "#A32D2D" }}>{r.manager ?? "Not assigned"}</td>
                <td style={{ padding: "10px 14px" }}>{date(r.renews)}</td>
                <td style={{ padding: "6px 14px", textAlign: "right" }}>
                  {canOpenAsFounder({ available: cap.available, hasPermission: cap.hasPermission, staffId: cap.staffId, managerId: r.managerId }) ? (
                    <OpenAsFounderButton founderId={r.founderId} founderName={r.founder} label="Open as founder" />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
