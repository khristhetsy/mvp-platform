// The fixed advisory-only line on every public AEO page. Locked copy — never a
// merge field, never per-page. Server-rendered.

import { AEO_COMPLIANCE_FOOTER } from "@/lib/aeo/types";

export function ComplianceFooter() {
  return (
    <footer data-aeo="compliance-footer" className="mt-12 border-t border-slate-200 pt-6">
      <p className="text-xs leading-relaxed text-slate-500">{AEO_COMPLIANCE_FOOTER}</p>
    </footer>
  );
}
