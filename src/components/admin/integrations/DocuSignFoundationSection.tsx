import { useTranslations } from "next-intl";
import { PageSection } from "@/components/ui/workspace-layout";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function DocuSignFoundationSection() {
  const t = useTranslations("adminCmp");
  return (
    <PageSection title={t("docusign_foundation_phase_1")}>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <StatusBadge label={t("placeholder")} status="neutral" />
        <StatusBadge label={t("not_connected")} status="neutral" />
        <StatusBadge label={t("readiness_only")} status="success" />
      </div>
      <p className="mt-3 text-xs text-slate-600">
        iCapOS tracks document package execution readiness and signer prerequisites for SPV workflows. No envelopes
        are created and no documents are sent for signature in Phase 1.
      </p>
      <p className="mt-2 text-xs font-medium text-slate-700">{t("supported_in_a_future_phase")}</p>
      <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
        <li>{t("envelope_creation_from_approved_spv_packages")}</li>
        <li>{t("signer_routing_investor_admin_founder")}</li>
        <li>{t("status_callbacks_and_execution_audit_trail")}</li>
      </ul>
      <p className="mt-3 text-xs text-slate-500">
        Current phase: readiness at Admin → SPVs. Review blocked packages and signer gaps before connecting DocuSign.
      </p>
    </PageSection>
  );
}
