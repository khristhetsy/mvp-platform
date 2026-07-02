import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { getTemplates } from "@/lib/marketing/templates";
import { TemplatesClient } from "./TemplatesClient";

export const dynamic = "force-dynamic";

export default async function MarketingTemplatesPage() {
  const t = await getTranslations("adminPages");
  await requireRole(["admin"]);
  const templates = await getTemplates();
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 500 }}>{t("emailTemplates")}</h1>
      </div>
      <TemplatesClient templates={templates} />
    </div>
  );
}
