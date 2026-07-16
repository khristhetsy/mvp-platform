import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { listScenarios, getLatestSnapshot, loadActualsAnchor, loadActualsSeries } from "@/lib/forecast/store";
import { getSalesScope } from "@/lib/sales/scope";
import { forecastOwnerId } from "@/lib/sales/forecast-scope";
import { SalesHubHeader } from "../SalesHubHeader";
import { ForecastClient } from "./ForecastClient";

export const dynamic = "force-dynamic";

export default async function SalesForecastPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const scope = await getSalesScope(profile);
  const { scope: scopeParam } = await searchParams;
  const viewScope: "all" | "mine" = scope.isManager && scopeParam === "mine" ? "mine" : "all";
  const ownerId = forecastOwnerId(scope, profile.id, scopeParam);

  const scenarios = await listScenarios();
  const active = scenarios.find((s) => s.is_active && s.kind === "base") ?? scenarios.find((s) => s.is_active) ?? scenarios[0] ?? null;
  const [latest, anchor, series] = await Promise.all([
    active ? getLatestSnapshot(active.id, ownerId) : Promise.resolve(null),
    loadActualsAnchor(),
    loadActualsSeries(),
  ]);

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <ForecastClient
        scenarios={scenarios}
        activeScenarioId={active?.id ?? null}
        initialSnapshot={latest ? { meta: latest.meta, output: latest.output } : null}
        anchor={anchor}
        actualsSeries={series}
        canToggleScope={scope.isManager}
        viewScope={viewScope}
      />
    </AppShell>
  );
}
