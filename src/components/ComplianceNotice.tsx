import { complianceDisclaimers } from "@/lib/compliance";
import { useTranslations } from "next-intl";

export function ComplianceNotice() {
  const t = useTranslations("sharedCmp");
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
      <h2 className="font-semibold">{t("important_compliance_notice")}</h2>
      <ul className="mt-3 grid gap-2 md:grid-cols-2">
        {complianceDisclaimers.map((disclaimer) => (
          <li key={disclaimer}>• {disclaimer}</li>
        ))}
      </ul>
    </section>
  );
}
