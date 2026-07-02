import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { VisibilityClient } from "@/components/aeo/admin/VisibilityClient";

export const dynamic = "force-dynamic";

export default async function AeoVisibilityPage() {
  const t = await getTranslations("adminPages");
  await requireRole(["admin"]);
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".14em", color: "#2E78F5", margin: 0 }}>{t("mktAeoVisibility")}</p>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "#0f2147", margin: "6px 0 4px" }}>{t("aiVisibility")}</h1>
        <p style={{ fontSize: 13, color: "#5f5e5a", margin: 0, maxWidth: 640 }}>
          A thin, read-only view over a rented provider (Frase or Peec). This is not a tracker — it renders what the provider reports, cached, with an honest empty state when nothing is connected.
        </p>
      </div>
      <VisibilityClient />
    </div>
  );
}
