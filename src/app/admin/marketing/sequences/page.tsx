import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { getSequences } from "@/lib/marketing/sequences";
import { getTemplates } from "@/lib/marketing/templates";
import { getLists } from "@/lib/marketing/contacts";
import { SequencesClient } from "./SequencesClient";

export const dynamic = "force-dynamic";

export default async function MarketingSequencesPage() {
  const t = await getTranslations("adminPages");
  await requireRole(["admin"]);
  const [sequences, templates, lists] = await Promise.all([
    getSequences(),
    getTemplates(),
    getLists(),
  ]);
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 500 }}>{t("sequences")}</h1>
      </div>
      <SequencesClient sequences={sequences} templates={templates} lists={lists} />
    </div>
  );
}
