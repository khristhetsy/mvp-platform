import { requireRole } from "@/lib/supabase/auth";
import { getImportOverview, getContactList } from "@/lib/prospects/store";
import { getVerifyStats } from "@/lib/verify/store";
import { providerConfigured } from "@/lib/append/provider";
import { getAudienceStats, getHotQueue } from "@/lib/approach/store";
import { ProspectsStepper } from "./ProspectsStepper";
import { ImportStep } from "./ImportStep";
import { VerifyClient } from "@/app/admin/crm/verify/VerifyClient";
import { AudienceClient } from "@/app/admin/crm/audience/AudienceClient";
import { ContactListStep } from "./ContactListStep";
import { ExportStep } from "./ExportStep";

export const dynamic = "force-dynamic";

type Step = "import" | "verify" | "approach" | "list" | "export";

function parseStep(raw: string | undefined): Step {
  return (["import", "verify", "approach", "list", "export"].includes(raw ?? "") ? raw : "import") as Step;
}

interface Props {
  searchParams: Promise<{ step?: string; side?: string; segment?: string; status?: string; search?: string }>;
}

export default async function ProspectsPage({ searchParams }: Props) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const step = parseStep(params.step);

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#1A6CE4" }}>Prospect Intelligence</p>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)", margin: "2px 0 2px" }}>Prospects</h1>
        <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", maxWidth: "66ch" }}>
          One pipeline for every prospect: import from any source, verify &amp; enrich, score how to approach, build the list, and export.
        </p>
      </div>

      <ProspectsStepper active={step} />

      <div style={{ marginTop: 16 }}>
        {step === "import" ? <ImportStep overview={await getImportOverview()} /> : null}
        {step === "verify" ? <VerifyClient stats={await getVerifyStats()} providerReady={providerConfigured()} /> : null}
        {step === "approach" ? <AudienceClient stats={await getAudienceStats()} initialHot={await getHotQueue(50)} /> : null}
        {step === "list" ? (
          <ContactListStep
            result={await getContactList({ side: params.side, segment: params.segment, status: params.status, search: params.search, limit: 50 })}
            filters={{ side: params.side ?? "", segment: params.segment ?? "", status: params.status ?? "", search: params.search ?? "" }}
          />
        ) : null}
        {step === "export" ? <ExportStep /> : null}
      </div>
    </div>
  );
}
