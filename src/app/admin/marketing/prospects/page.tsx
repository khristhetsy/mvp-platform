import { requireRole } from "@/lib/supabase/auth";
import { getVerifyStats } from "@/lib/verify/store";
import { providerConfigured } from "@/lib/append/provider";
import { ProspectsStepper } from "./ProspectsStepper";
import { WizardShell } from "./WizardShell";
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
          <WizardShell
            completeHref="/admin/marketing/prospects?step=approach"
            completeLabel="Complete stage → AI Approach"
            steps={[
              { label: "Overview & run", content: <VerifyClient stats={await getVerifyStats()} providerReady={providerConfigured()} /> },
              { label: "Verify & correct", content: <VerifyContactList /> },
              {
                label: "Confirm",
                content: (
                  <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)" }}>
                    <h3 style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Verified &amp; corrected</h3>
                    <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Emails checked, gaps enriched where possible, phones flagged for consent. When you&rsquo;re happy with the list, move on to score how to approach it.</p>
                  </div>
                ),
              },
            ]}
          />
        ) : null}
        {step === "approach" ? (
          <WizardShell
            completeHref="/admin/marketing/prospects?step=list"
            completeLabel="Complete stage → Contact Lists"
            steps={[{ label: "Score & review", content: <ApproachListView /> }]}
          />
        ) : null}
        {step === "list" ? (
          <WizardShell
            completeHref="/admin/marketing/lists"
            completeLabel="Finish → open Contact Lists"
            steps={[{ label: "Manage lists", content: <SavedListsDirectory /> }]}
          />
        ) : null}
      </div>
    </div>
  );
}
