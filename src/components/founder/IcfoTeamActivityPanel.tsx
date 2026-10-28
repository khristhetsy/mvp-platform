import { createServiceRoleClient } from "@/lib/supabase/admin";
import { MANAGED_ICFO_ROLE } from "@/lib/team/managed-icfo-core";
import { humanizeAction } from "@/lib/team/staff-activity";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return createServiceRoleClient();
}

type Entry = { at: string; who: string; what: string };

function when(value: string) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Shown to the founder: which iCFO staff manage the account, when they opened it, and the
 * changes they made. Only what iCapOS records is listed. Renders nothing for accounts with
 * no managed access and no staff activity.
 */
export async function IcfoTeamActivityPanel({ founderId, companyId }: { founderId: string; companyId: string }) {
  const [{ data: members }, { data: sessions }, { data: changes }] = await Promise.all([
    db().from("company_members").select("user_id").eq("company_id", companyId).eq("role", MANAGED_ICFO_ROLE),
    db()
      .from("operational_activity_events")
      .select("actor_user_id, created_at")
      .eq("event_type", "act_on_behalf_started")
      .eq("entity_id", founderId)
      .order("created_at", { ascending: false })
      .limit(10),
    db()
      .from("audit_logs")
      .select("action, metadata, created_at")
      .eq("user_id", founderId)
      .not("metadata->>acting_staff_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const managerIds = ((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id);
  const sessionRows = (sessions ?? []) as Array<{ actor_user_id: string | null; created_at: string }>;
  const changeRows = (changes ?? []) as Array<{ action: string | null; metadata: { acting_staff_id?: string } | null; created_at: string }>;
  if (!managerIds.length && !sessionRows.length && !changeRows.length) return null;

  const staffIds = [
    ...new Set([
      ...managerIds,
      ...sessionRows.map((s) => s.actor_user_id).filter((id): id is string => Boolean(id)),
      ...changeRows.map((c) => c.metadata?.acting_staff_id).filter((id): id is string => Boolean(id)),
    ]),
  ];
  const { data: people } = staffIds.length ? await db().from("profiles").select("id, full_name, email").in("id", staffIds) : { data: [] };
  const nameOf = new Map<string, string>(
    ((people ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((p) => [p.id, p.full_name ?? p.email ?? "iCFO team"]),
  );
  const name = (id: string | null | undefined) => (id ? (nameOf.get(id) ?? "iCFO team") : "iCFO team");

  const activity: Entry[] = [
    ...sessionRows.map((s) => ({ at: s.created_at, who: name(s.actor_user_id), what: "Opened your account to work on it" })),
    ...changeRows.map((c) => ({ at: c.created_at, who: name(c.metadata?.acting_staff_id), what: humanizeAction(c.action) })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 20);

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Your iCFO team</h2>
        <p className="mt-0.5 text-xs text-slate-500">Who manages your account, and what they have done in it. Billing stays with you.</p>
      </div>
      <div className="space-y-4 p-6">
        {managerIds.length ? (
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Account manager:</span> {managerIds.map((id) => name(id)).join(", ")}
          </p>
        ) : null}
        {activity.length ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {activity.map((a, i) => (
              <li key={`${a.at}-${i}`} className="flex flex-wrap items-baseline gap-x-3 py-2">
                <span className="w-36 shrink-0 text-xs text-slate-500">{when(a.at)}</span>
                <span className="font-medium text-slate-900">{a.who}</span>
                <span className="text-slate-600">{a.what}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No iCFO team activity has been recorded yet.</p>
        )}
        <p className="text-xs text-slate-400">Shows sessions and key changes recorded by iCapOS.</p>
      </div>
    </section>
  );
}
