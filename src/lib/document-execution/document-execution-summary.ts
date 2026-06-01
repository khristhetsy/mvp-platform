import { createServiceRoleClient } from "@/lib/supabase/admin";
import { computeSpvExecutionReadiness } from "@/lib/document-execution/readiness";
import { EXECUTION_PACKAGE_DEFINITIONS } from "@/lib/document-execution/package-mapping";
import {
  countCriticalOpenComplianceForCompany,
  listAdminClosingReviewsBySpv,
} from "@/lib/spv/closing-reviews";
import { listSpvDocumentPackages } from "@/lib/spv/document-packages";
import { listSpvParticipationsForOpportunity } from "@/lib/spv/spv-workflow";

export function isDocumentExecutionIntent(message: string): boolean {
  const lower = message.toLowerCase();
  const mentionsExecution =
    lower.includes("docusign") ||
    lower.includes("document execution") ||
    lower.includes("signature readiness") ||
    (lower.includes("signer") && (lower.includes("missing") || lower.includes("readiness")));
  const mentionsSpvExecution =
    lower.includes("spv") &&
    (lower.includes("execution") || lower.includes("signature") || lower.includes("ready"));

  if (!mentionsExecution && !mentionsSpvExecution) {
    return false;
  }

  return (
    lower.includes("ready") ||
    lower.includes("block") ||
    lower.includes("signer") ||
    lower.includes("connect") ||
    lower.includes("docusign") ||
    lower.includes("execution") ||
    lower.includes("missing")
  );
}

export async function formatDocumentExecutionForAssistant(
  message: string,
  spvId: string | null,
  entityType: string | null,
): Promise<string> {
  const lower = message.toLowerCase();
  const lines: string[] = ["**Document execution readiness (Phase 1)**", ""];

  if (lower.includes("docusign") || lower.includes("connect")) {
    lines.push(
      "**DocuSign is not connected.** Phase 1 tracks execution and signer readiness only. Future phases may support envelope creation, signer routing, and status callbacks.",
    );
  } else {
    lines.push(
      "**DocuSign:** Not connected. No envelopes are created and no documents are sent for signature.",
    );
  }

  lines.push(
    "**Packages tracked:** " +
      EXECUTION_PACKAGE_DEFINITIONS.filter((d) => !d.placeholderOnly)
        .map((d) => d.label)
        .join(", ") +
      ".",
  );
  lines.push("**Privacy:** No uploaded files, document paths, message bodies, or legal terms are shown.");

  const resolvedSpvId = spvId ?? (entityType === "spv" ? spvId : null);
  if (resolvedSpvId) {
    const admin = createServiceRoleClient();
    const { data: spv } = await admin.from("spv_opportunities").select("*").eq("id", resolvedSpvId).maybeSingle();
    if (spv) {
      const [packages, parts, closing] = await Promise.all([
        listSpvDocumentPackages(admin, resolvedSpvId),
        listSpvParticipationsForOpportunity(admin, resolvedSpvId),
        listAdminClosingReviewsBySpv(admin, [resolvedSpvId]),
      ]);
      const { data: reqs } = await admin
        .from("spv_participation_requirements")
        .select("*")
        .eq("spv_opportunity_id", resolvedSpvId);

      const critical = await countCriticalOpenComplianceForCompany(admin, spv.company_id);
      const summary = computeSpvExecutionReadiness({
        spv,
        packages: packages.data ?? [],
        participations: parts.data ?? [],
        requirements: reqs ?? [],
        closingReview: closing.data?.[resolvedSpvId] ?? null,
        criticalComplianceOpenCount: critical.count,
        hasFounderSigner: Boolean(spv.created_by),
      });

      lines.push(
        "",
        `**${summary.spvName}:** ${summary.executionReadinessPct}% execution readiness · ${summary.signerReadinessPct}% signer readiness.`,
        `**Ready for future e-sign:** ${summary.readyForFutureEsign ? "Yes (when DocuSign connects)" : "Not yet"}.`,
        `**Next step:** ${summary.nextRequiredStep}`,
      );

      if (lower.includes("block") && summary.blockedPackages.length) {
        lines.push(`**Blocked packages:** ${summary.blockedPackages.map((p) => p.label).join(", ")}.`);
      }

      const missingSigners = summary.signers.filter((s) => s.status !== "present");
      if ((lower.includes("signer") || lower.includes("missing")) && missingSigners.length) {
        lines.push(
          `**Signer gaps:** ${missingSigners.map((s) => `${s.label} (${s.status})`).join("; ")}.`,
        );
        for (const s of missingSigners) {
          if (s.blockedReason) {
            lines.push(`- ${s.label}: ${s.blockedReason}`);
          }
        }
      }
    }
  } else if (lower.includes("ready") || lower.includes("block") || lower.includes("signer")) {
    lines.push("", "Open **Admin → SPVs** or ask about a specific SPV for detailed readiness.");
  }

  lines.push("", "Manage readiness at **/admin/spvs** and **/admin/integrations** (DocuSign foundation card).");

  return lines.join("\n");
}
