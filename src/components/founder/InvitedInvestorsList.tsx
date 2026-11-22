import type { DataRoomGrant } from "@/lib/data-room/access";

function statusOf(g: DataRoomGrant): { label: string; tone: string } {
  if (g.revokedAt) return { label: "Revoked", tone: "bg-slate-100 text-slate-600" };
  if (!g.active) return { label: "Expired", tone: "bg-slate-100 text-slate-600" };
  return { label: "Access active", tone: "bg-emerald-50 text-emerald-700" };
}

function initials(g: DataRoomGrant): string {
  const base = (g.investorName ?? g.investorEmail ?? "?").trim();
  const parts = base.split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Investors the founder has invited into the data room, with their access status. */
export function InvitedInvestorsList({ grants }: { grants: DataRoomGrant[] }) {
  if (grants.length === 0) return <p className="text-sm text-slate-500">No investors invited yet.</p>;
  return (
    <div className="divide-y divide-slate-100">
      {grants.map((g) => {
        const s = statusOf(g);
        return (
          <div key={g.id} className="flex items-center gap-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-700">
              {initials(g)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{g.investorName ?? g.investorEmail ?? "Investor"}</p>
              {g.investorName && g.investorEmail ? <p className="truncate text-xs text-slate-500">{g.investorEmail}</p> : null}
            </div>
            <span className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.tone}`}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}
