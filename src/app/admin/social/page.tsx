import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { listSocialAccounts, listQueue, getSocialSettings, getSlots } from "@/lib/social/queries";
import { isLinkedInConfigured } from "@/lib/social/linkedin-adapter";
import { isLinkedInOAuthConfigured } from "@/lib/social/linkedin-oauth";
import { getAttribution } from "@/lib/social/attribution";
import { SocialHubClient } from "@/components/admin/social/SocialHubClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Social Media Hub" };

const CONNECT_NOTICE: Record<string, { tone: "ok" | "warn"; text: string }> = {
  connected: { tone: "ok", text: "LinkedIn account connected. Approved variants will publish through it." },
  unconfigured: { tone: "warn", text: "LinkedIn isn't configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET, then try again." },
};

export default async function AdminSocialPage({ searchParams }: { searchParams: Promise<{ linkedin?: string; message?: string }> }) {
  const sp = await searchParams;
  const notice = sp.linkedin === "error"
    ? { tone: "warn" as const, text: `Couldn't connect LinkedIn${sp.message ? `: ${sp.message}` : "."}` }
    : sp.linkedin ? CONNECT_NOTICE[sp.linkedin] : undefined;
  const profile = await requireRole(["admin", "analyst"]);
  const [accounts, queue, settings, slots, attribution] = await Promise.all([
    listSocialAccounts().catch(() => []),
    listQueue().catch(() => []),
    getSocialSettings().catch(() => ({ approve_before_publish: true, rewrite_per_account: true, skip_empty_slot: true, auto_publish: false, rotation: ["proof_case", "teardown", "named_ask"] })),
    getSlots().catch(() => []),
    getAttribution().catch(() => []),
  ]);

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Social Media Hub">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Social Media Hub</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Publishing only — Prospects and Scheduling stay in Sales Hub. LinkedIn first; the queue runs every 5 minutes and the tagged link posts as the first comment.</p>

        {notice ? (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-[13px] ${notice.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            <i className={`ti ${notice.tone === "ok" ? "ti-circle-check" : "ti-alert-triangle"}`} aria-hidden="true" /> {notice.text}
          </div>
        ) : null}

        {!isLinkedInConfigured() ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            <i className="ti ti-alert-triangle" aria-hidden="true" /> LinkedIn isn&rsquo;t connected. Add a LinkedIn app (LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET) and connect an account to publish. You can draft, approve, and queue now — variants publish once connected.
          </div>
        ) : null}

        <div className="mt-5">
          <SocialHubClient accounts={accounts} queue={queue} settings={settings} slots={slots} linkedInReady={isLinkedInOAuthConfigured()} attribution={attribution} />
        </div>
      </div>
    </AppShell>
  );
}
