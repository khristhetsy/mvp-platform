import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowLeft } from "lucide-react";
import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import {
  getSubscriptionForProfile,
  ensureSubscriptionForProfile,
  refreshSubscriptionState,
} from "@/lib/subscriptions/get-subscription";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";
import { listPublicEvents } from "@/lib/icfo-events/queries";
import { presentTierForPlan } from "@/lib/icfo-events/present-tiers";
import type { EventRecord } from "@/lib/icfo-events/types";
import { PresentAtEventClient, type PresentEventOption, type ExistingApplication } from "./PresentAtEventClient";

export const dynamic = "force-dynamic";

export default async function PresentAtEventPage() {
  const profile = await requireRole(["founder"]);
  const supabase = await createServerSupabaseClient();
  const company = await ensureFounderCompanyForUser(profile);

  let sub = await getSubscriptionForProfile(profile.id);
  if (!sub) sub = await ensureSubscriptionForProfile({ profileId: profile.id, role: profile.role });
  sub = await refreshSubscriptionState(sub);
  const tier = presentTierForPlan(sub.plan_type);

  let events: EventRecord[] = [];
  try {
    events = await listPublicEvents(supabase);
  } catch {
    events = [];
  }
  const eventOptions: PresentEventOption[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    startsAt: e.startsAt,
  }));

  // The founder's own applications (RLS returns only their rows).
  let existing: ExistingApplication[] = [];
  try {
    const { data } = await (supabase as unknown as SupabaseClient)
      .from("speaker_applications")
      .select("event_id, status, kind, topic, created_at")
      .eq("applicant_id", profile.id)
      .order("created_at", { ascending: false });
    existing = (data ?? []).map((r: Record<string, unknown>) => ({
      eventId: String(r.event_id),
      status: String(r.status),
      kind: String(r.kind),
      topic: String(r.topic),
    }));
  } catch {
    existing = [];
  }

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <WorkspacePageContainer>
        <Link
          href="/founder/events"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to events
        </Link>

        <PageHeader
          eyebrow="iCFO Events"
          title="Present at an event"
          description="Apply to take the stage in front of the room. Your application goes to the iCFO events team for review — you'll be notified when a decision is made."
        />

        <div className="mt-8">
          <PresentAtEventClient
            tier={tier}
            planLabel={PLAN_LABELS[sub.plan_type]}
            events={eventOptions}
            existing={existing}
          />
        </div>
      </WorkspacePageContainer>
    </FounderAppShell>
  );
}
