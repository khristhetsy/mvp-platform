import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { AeoListClient } from "@/components/aeo/admin/AeoListClient";
import { CopilotPanel } from "@/components/marketing/copilot/CopilotPanel";

export const dynamic = "force-dynamic";

export default async function AeoAdminPage() {
  const t = await getTranslations("adminPages");
  await requireRole(["admin"]);
  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".14em", color: "#534AB7", margin: 0 }}>{t("mktAeo")}</p>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "#0f2147", margin: "6px 0 4px" }}>{t("aiSeoPages")}</h1>
        <p style={{ fontSize: 13, color: "#5f5e5a", margin: 0, maxWidth: 660 }}>
          Author citable pillar pages published at <code>/learn/[slug]</code>. Each page drives its own schema, so the structured data always matches the visible answer.
        </p>
      </div>
      <AeoListClient />
      <CopilotPanel topic="aeo" />
    </div>
  );
}
