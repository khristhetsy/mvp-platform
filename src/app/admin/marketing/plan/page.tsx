import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { getPlans } from "@/lib/marketing/plans";
import { isClaudeConfigured } from "@/lib/claude";
import { PlanClient } from "./PlanClient";
import { CopilotPanel } from "@/components/marketing/copilot/CopilotPanel";

export const dynamic = "force-dynamic";

export default async function MarketingPlanPage() {
  const t = await getTranslations("adminPages");
  await requireRole(["admin"]);
  const plans = await getPlans();
  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500 }}>{t("marketingPlan")}</h1>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
            Build a strategy manually or let the AI CMO draft one, then sync
            initiatives to Tasks.
          </p>
        </div>
      </div>
      <PlanClient plans={plans} aiEnabled={isClaudeConfigured()} />
      <CopilotPanel topic="cmo" />
    </div>
  );
}
