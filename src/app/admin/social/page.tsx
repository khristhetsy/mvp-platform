import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { listSocialAccounts, listQueue } from "@/lib/social/queries";
import { isLinkedInConfigured } from "@/lib/social/linkedin-adapter";

export const dynamic = "force-dynamic";
export const metadata = { title: "Social Media Hub" };

const STATUS_STYLE: Record<string, string> = {
  queued: "bg-amber-50 text-amber-700",
  publishing: "bg-blue-50 text-blue-700",
  published: "bg-emerald-50 text-emerald-700",
  failed: "bg-rose-50 text-rose-700",
  skipped: "bg-slate-100 text-slate-500",
};

export default async function AdminSocialPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const [accounts, queue] = await Promise.all([listSocialAccounts().catch(() => []), listQueue().catch(() => [])]);
  const linkedInReady = isLinkedInConfigured();

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Social Media Hub">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Social Media Hub</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Publish to LinkedIn on approval. The queue runs every 5 minutes; the tagged link posts as the first comment.</p>

        {!linkedInReady ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            <i className="ti ti-alert-triangle" aria-hidden="true" /> LinkedIn isn&rsquo;t connected yet. Add a LinkedIn developer app (LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET) and connect an account to publish. The engine is live but inert until then.
          </div>
        ) : null}

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--text-secondary)]">Accounts</h2>
            <button type="button" disabled={!linkedInReady} className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] disabled:opacity-50">
              <i className="ti ti-brand-linkedin" aria-hidden="true" /> Connect LinkedIn
            </button>
          </div>
          <div className="mt-2 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white">
            {accounts.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">No accounts connected yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {accounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-4 py-3 text-[13px]">
                    <span className="font-medium text-[var(--text-primary)]">{a.display_name ?? a.platform}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[a.status] ?? "bg-slate-100 text-slate-600"}`}>{a.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-medium text-[var(--text-secondary)]">Queue</h2>
          <div className="mt-2 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white">
            {queue.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">Nothing queued. Approved posts appear here per account, then publish on the next 5-minute pass.</p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {queue.map((q) => (
                  <li key={q.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-primary)]">{q.body}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[q.status] ?? "bg-slate-100 text-slate-600"}`}>{q.status}</span>
                    </div>
                    {q.error ? <p className="mt-1 text-[11px] text-rose-600">{q.error}{q.attempts ? ` · attempt ${q.attempts}` : ""}</p> : null}
                    {q.url ? <a href={q.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[11px] text-blue-600">View post</a> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <p className="mt-6 text-[11px] text-[var(--text-muted)]">Phase 3 foundation. Composer and the LinkedIn connect flow are the next build — the engine (queue, retries, adapter) is already running.</p>
      </div>
    </AppShell>
  );
}
