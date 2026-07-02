import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/supabase/auth";
import { assemblePlaybook } from "@/lib/playbook/assemble";
import { PlaybookConsole } from "@/components/playbook/PlaybookConsole";

export const dynamic = "force-dynamic";

export default async function AdminPlaybookPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const t = await getTranslations("adminPages");
  const assembled = await assemblePlaybook();
  const isAdmin = profile.role === "admin";

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("dailyOperatingConsole")}
      profileEmail={profile.email ?? undefined}
    >
      <div style={{ marginBottom: 18 }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".16em", color: "#534AB7", margin: 0 }}>Operations</p>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: "#0f2147", margin: "6px 0 4px", letterSpacing: "-0.01em" }}>Daily Operating Console</h1>
        <p style={{ fontSize: 13, color: "#5f5e5a", margin: 0, maxWidth: 680 }}>
          The operating playbook, rendered from the live admin menu plus editable steps. New surfaces appear here automatically; renamed ones update; removed ones are flagged for cleanup — so the doc can never quietly drift from the product.
        </p>
      </div>
      <PlaybookConsole initial={assembled} isAdmin={isAdmin} />
    </AppShell>
  );
}
