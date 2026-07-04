import { requireRole } from "@/lib/supabase/auth";
import { getVerifyStats } from "@/lib/verify/store";
import { providerConfigured } from "@/lib/append/provider";
import { ProspectsStepper } from "./ProspectsStepper";
import { CreateListWizard } from "./CreateListWizard";
import { VerifyClient } from "@/app/admin/crm/verify/VerifyClient";
import { VerifyContactList } from "./VerifyContactList";
import { ApproachListView } from "./ApproachListView";
import { SavedListsDirectory } from "./SavedListsDirectory";

export const dynamic = "force-dynamic";

type Step = "create" | "verify" | "approach" | "list";

function parseStep(raw: string | undefined): Step {
  // legacy step ids (import/export) fold into create/list
  if (raw === "import") return "create";
  if (raw === "export") return "list";
  return (["create", "verify", "approach", "list"].includes(raw ?? "") ? raw : "create") as Step;
}

interface Props {
  searchParams: Promise<{ step?: string }>;
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
          Everything runs on contact lists: create a list from any source, verify &amp; correct it, score how to approach, then manage &amp; export from the lists directory.
        </p>
      </div>

      <ProspectsStepper active={step} />

      <div style={{ marginTop: 16 }}>
        {step === "create" ? <CreateListWizard /> : null}
        {step === "verify" ? (
          <>
            <VerifyClient stats={await getVerifyStats()} providerReady={providerConfigured()} />
            <VerifyContactList />
          </>
        ) : null}
        {step === "approach" ? <ApproachListView /> : null}
        {step === "list" ? <SavedListsDirectory /> : null}
      </div>
    </div>
  );
}
