import { PageSection } from "@/components/ui/workspace-layout";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function DocuSignFoundationSection() {
  return (
    <PageSection title="DocuSign foundation (Phase 1)">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <StatusBadge label="Placeholder" status="neutral" />
        <StatusBadge label="Not connected" status="neutral" />
        <StatusBadge label="Readiness only" status="success" />
      </div>
      <p className="mt-3 text-xs text-slate-600">
        iCapOS tracks document package execution readiness and signer prerequisites for SPV workflows. No envelopes
        are created and no documents are sent for signature in Phase 1.
      </p>
      <p className="mt-2 text-xs font-medium text-slate-700">Supported in a future phase</p>
      <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
        <li>Envelope creation from approved SPV packages</li>
        <li>Signer routing (investor, admin, founder)</li>
        <li>Status callbacks and execution audit trail</li>
      </ul>
      <p className="mt-3 text-xs text-slate-500">
        Current phase: readiness at Admin → SPVs. Review blocked packages and signer gaps before connecting DocuSign.
      </p>
    </PageSection>
  );
}
