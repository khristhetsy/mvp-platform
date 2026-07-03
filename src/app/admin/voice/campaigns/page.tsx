import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { listCampaigns } from "@/lib/voice/campaigns";
import { voiceOutboundEnabled } from "@/lib/voice/gate";
import { GUARDRAIL_VERSION } from "@/lib/voice/guardrail";
import { CampaignsManager } from "@/components/voice/CampaignsManager";
import type { VoiceCampaign } from "@/lib/voice/types";

export const dynamic = "force-dynamic";

export default async function VoiceCampaignsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const campaigns = await listCampaigns().catch(() => [] as VoiceCampaign[]);
  const enabled = voiceOutboundEnabled();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "#1A6CE4" }}>Operate · Voice</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Campaigns</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Configure audience, guardrail version, and A/B opener variants. Scripts are checked against the compliance lexicon on
            save, and the AI disclosure is prepended to every opener automatically.
          </p>
        </div>

        {!enabled && (
          <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <strong>Dormant.</strong> Configuring a campaign does not place any calls. Outbound stays disabled until the gate,
            a chosen runtime, and legal sign-off are all in place.
          </div>
        )}

        <CampaignsManager initial={campaigns} canWrite={profile.role === "admin"} guardrailVersion={GUARDRAIL_VERSION} />
      </div>
    </AppShell>
  );
}
