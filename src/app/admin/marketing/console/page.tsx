import { requireRole } from "@/lib/supabase/auth";
import { assembleMarketingConsole } from "@/lib/playbook/assemble";
import { PlaybookConsole } from "@/components/playbook/PlaybookConsole";

export const dynamic = "force-dynamic";

const MARKETING_ENDPOINTS = {
  get: "/api/admin/marketing/console",
  counts: null,
  patch: "/api/admin/marketing/console/module",
};

export default async function MarketingConsolePage() {
  const profile = await requireRole(["admin", "analyst"]);
  const assembled = await assembleMarketingConsole();
  const isAdmin = profile.role === "admin";

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".16em", color: "#534AB7", margin: 0 }}>Marketing · Console</p>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: "#0f2147", margin: "6px 0 4px", letterSpacing: "-0.01em" }}>Marketing Daily Operating Console</h1>
        <p style={{ fontSize: 13, color: "#5f5e5a", margin: 0, maxWidth: 680 }}>
          The eleven-module marketing loop in operating order — Open, then Core, then Close — each card linking to the hub surface where the work happens. Compliance gates are marked; steps and cadence are editable inline by admins.
        </p>
      </div>
      <PlaybookConsole initial={assembled} isAdmin={isAdmin} endpoints={MARKETING_ENDPOINTS} />
    </div>
  );
}
