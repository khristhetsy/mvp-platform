"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { List, LayoutGrid, Columns, X, Loader2 } from "lucide-react";
import {
  FOUNDER_STAGES,
  INVESTOR_RELS,
  type CrmModule,
  type CrmView,
  type FounderRecord,
  type InvestorRecord,
  type MatchRow,
} from "@/lib/crm/types";
import { INTEREST_LEVEL_LABEL, NON_BINDING_NOTE } from "@/lib/crm/lexicon";

const NAVY = "#0A1A40";
const BLUE = "#2E78F5";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, background: BLUE }} />
      </div>
      <span className="tabular-nums text-xs font-medium text-slate-700">{value}</span>
    </div>
  );
}

function OwnerDot({ initials }: { initials: string }) {
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
      style={{ background: NAVY }}
    >
      {initials}
    </span>
  );
}

function InterestPill({ level }: { level: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
      {INTEREST_LEVEL_LABEL[level] ?? level}
    </span>
  );
}

type Props = {
  module: CrmModule;
  founders?: FounderRecord[];
  investors?: InvestorRecord[];
};

export function CrmConsole({ module, founders = [], investors = [] }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const view = (params.get("view") as CrmView) || "list";
  const selectedId = params.get("id");
  const [filter, setFilter] = useState<string>("");
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const records = module === "founder" ? founders : investors;
  const filtered = useMemo(() => {
    if (!filter) return records;
    if (module === "founder") return (records as FounderRecord[]).filter((r) => r.stage === filter);
    return (records as InvestorRecord[]).filter((r) => r.kyc === filter || r.rel === filter);
  }, [records, filter, module]);

  const selected = useMemo(
    () => (selectedId ? records.find((r) => r.id === selectedId) ?? null : null),
    [records, selectedId],
  );

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- fetch match layer on selection */
    if (!selectedId) {
      setMatches(null);
      return;
    }
    let alive = true;
    setMatchLoading(true);
    fetch(`/api/crm/matches/${module}/${selectedId}`)
      .then((r) => r.json())
      .then((d) => alive && setMatches(d.matches ?? []))
      .catch(() => alive && setMatches([]))
      .finally(() => alive && setMatchLoading(false));
    return () => {
      alive = false;
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [module, selectedId]);

  const stages = module === "founder" ? FOUNDER_STAGES : INVESTOR_RELS;

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-200 p-1">
          {([
            { v: "list", Icon: List },
            { v: "board", Icon: Columns },
            { v: "cards", Icon: LayoutGrid },
          ] as const).map(({ v, Icon }) => (
            <button
              key={v}
              onClick={() => setParam("view", v)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${
                view === v ? "text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
              style={view === v ? { background: BLUE } : undefined}
            >
              <Icon className="h-3.5 w-3.5" /> {v}
            </button>
          ))}
        </div>

        {view !== "board" && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilter("")}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                filter === "" ? "border-[var(--blue)] bg-[var(--blue-muted)] text-[var(--blue-hover)]" : "border-slate-200 text-slate-600"
              }`}
            >
              All
            </button>
            {(module === "founder"
              ? FOUNDER_STAGES.map((s) => ({ key: s.key, label: s.label }))
              : [
                  { key: "Verified", label: "KYC verified" },
                  { key: "Pending", label: "KYC pending" },
                  ...INVESTOR_RELS.map((r) => ({ key: r.key, label: r.label })),
                ]
            ).map((chip) => (
              <button
                key={chip.key}
                onClick={() => setFilter(chip.key)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                  filter === chip.key ? "border-[var(--blue)] bg-[var(--blue-muted)] text-[var(--blue-hover)]" : "border-slate-200 text-slate-600"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">
          No {module === "founder" ? "founders" : "investors"} to show yet.
        </div>
      ) : view === "list" ? (
        <ListView module={module} records={filtered} selectedId={selectedId} onSelect={(id) => setParam("id", id)} />
      ) : view === "cards" ? (
        <CardsView module={module} records={filtered} selectedId={selectedId} onSelect={(id) => setParam("id", id)} />
      ) : (
        <BoardView module={module} records={records} stages={stages} onSelect={(id) => setParam("id", id)} />
      )}

      {selected && (
        <DetailDrawer
          module={module}
          record={selected}
          matches={matches}
          matchLoading={matchLoading}
          onClose={() => setParam("id", null)}
        />
      )}
    </div>
  );
}

function StagePill({ label }: { label: string }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "#E7F0FE", color: "#1A6CE4" }}>
      {label}
    </span>
  );
}

function ListView({
  module,
  records,
  selectedId,
  onSelect,
}: {
  module: CrmModule;
  records: (FounderRecord | InvestorRecord)[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
            {module === "founder" ? (
              <>
                <th className="px-4 py-2.5 font-semibold">Company</th>
                <th className="px-4 py-2.5 font-semibold">Stage</th>
                <th className="px-4 py-2.5 font-semibold">Capital Readiness</th>
                <th className="px-4 py-2.5 font-semibold">Owner</th>
              </>
            ) : (
              <>
                <th className="px-4 py-2.5 font-semibold">Investor</th>
                <th className="px-4 py-2.5 font-semibold">Mandate</th>
                <th className="px-4 py-2.5 font-semibold">Investor Fit</th>
                <th className="px-4 py-2.5 font-semibold">Indicated</th>
                <th className="px-4 py-2.5 font-semibold">Owner</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const active = r.id === selectedId;
            return (
              <tr
                key={r.id}
                onClick={() => onSelect(r.id)}
                className={`cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50 ${active ? "bg-[var(--blue-muted)]" : ""}`}
              >
                {module === "founder" ? (
                  <FounderRowCells r={r as FounderRecord} />
                ) : (
                  <InvestorRowCells r={r as InvestorRecord} />
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FounderRowCells({ r }: { r: FounderRecord }) {
  return (
    <>
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900">{r.name}</div>
        <div className="text-xs text-slate-400">{r.raiseLabel}</div>
      </td>
      <td className="px-4 py-3"><StagePill label={FOUNDER_STAGES.find((s) => s.key === r.stage)?.label ?? r.stage} /></td>
      <td className="px-4 py-3">
        <ScoreBar value={r.readiness.score} />
        {r.readiness.scoreKind === "lead_prescore" && <div className="mt-0.5 text-[10px] text-slate-400">lead pre-score</div>}
      </td>
      <td className="px-4 py-3"><OwnerDot initials={r.ownerInitials} /></td>
    </>
  );
}

function InvestorRowCells({ r }: { r: InvestorRecord }) {
  return (
    <>
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900">{r.name}</div>
        <div className="text-xs text-slate-400">{r.kind}</div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {r.mandate.slice(0, 2).map((m, i) => (
            <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{m}</span>
          ))}
          {r.mandate.length > 2 && <span className="text-[10px] text-slate-400">+{r.mandate.length - 2}</span>}
        </div>
      </td>
      <td className="px-4 py-3"><ScoreBar value={r.fit} /></td>
      <td className="px-4 py-3 text-slate-700">{r.indicatedCount}</td>
      <td className="px-4 py-3"><OwnerDot initials={r.ownerInitials} /></td>
    </>
  );
}

function CardsView({
  module,
  records,
  selectedId,
  onSelect,
}: {
  module: CrmModule;
  records: (FounderRecord | InvestorRecord)[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
      {records.map((r) => {
        const active = r.id === selectedId;
        return (
          <button
            key={r.id}
            onClick={() => onSelect(r.id)}
            className={`rounded-xl border bg-white p-4 text-left transition hover:border-[var(--blue)] ${active ? "border-[var(--blue)] ring-2 ring-[var(--blue-muted)]" : "border-slate-200"}`}
          >
            {module === "founder" ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">{(r as FounderRecord).name}</span>
                  <OwnerDot initials={r.ownerInitials} />
                </div>
                <div className="mt-0.5 text-xs text-slate-400">{(r as FounderRecord).raiseLabel}</div>
                <div className="mt-2"><StagePill label={FOUNDER_STAGES.find((s) => s.key === (r as FounderRecord).stage)?.label ?? ""} /></div>
                <div className="mt-3"><ScoreBar value={(r as FounderRecord).readiness.score} /></div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">{(r as InvestorRecord).name}</span>
                  <OwnerDot initials={r.ownerInitials} />
                </div>
                <div className="mt-0.5 text-xs text-slate-400">{(r as InvestorRecord).kind}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(r as InvestorRecord).mandate.slice(0, 3).map((m, i) => (
                    <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{m}</span>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <ScoreBar value={(r as InvestorRecord).fit} />
                  <span className="text-xs text-slate-500">{(r as InvestorRecord).indicatedCount} indicated</span>
                </div>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

function BoardView({
  module,
  records,
  stages,
  onSelect,
}: {
  module: CrmModule;
  records: (FounderRecord | InvestorRecord)[];
  stages: { key: string; label: string }[];
  onSelect: (id: string) => void;
}) {
  const keyOf = (r: FounderRecord | InvestorRecord) =>
    module === "founder" ? (r as FounderRecord).stage : (r as InvestorRecord).rel;
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {stages.map((col) => {
        const cards = records.filter((r) => keyOf(r) === col.key);
        return (
          <div key={col.key} className="w-60 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-slate-700">{col.label}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{cards.length}</span>
            </div>
            <div className="space-y-2 rounded-xl bg-slate-50 p-2">
              {cards.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onSelect(r.id)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-[var(--blue)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium text-slate-900">{r.name}</span>
                    <OwnerDot initials={r.ownerInitials} />
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {module === "founder"
                      ? `CRR ${(r as FounderRecord).readiness.score}`
                      : `Fit ${(r as InvestorRecord).fit}`}
                  </div>
                </button>
              ))}
              {cards.length === 0 && <p className="px-1 py-3 text-center text-[11px] text-slate-400">Empty</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DetailDrawer({
  module,
  record,
  matches,
  matchLoading,
  onClose,
}: {
  module: CrmModule;
  record: FounderRecord | InvestorRecord;
  matches: MatchRow[] | null;
  matchLoading: boolean;
  onClose: () => void;
}) {
  const isFounder = module === "founder";
  const bigScore = isFounder ? (record as FounderRecord).readiness.score : (record as InvestorRecord).fit;
  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-[330px] max-w-[90vw] flex-col border-l border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{record.name}</p>
          <p className="text-xs text-slate-400">{isFounder ? (record as FounderRecord).raiseLabel : (record as InvestorRecord).kind}</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {isFounder ? "Capital Readiness Rating" : "Investor Fit"}
          </p>
          <p className="mt-1 text-3xl font-semibold" style={{ color: NAVY }}>{bigScore}</p>
          {isFounder && (record as FounderRecord).readiness.scoreKind === "lead_prescore" && (
            <p className="text-[11px] text-slate-400">lead pre-score (un-onboarded)</p>
          )}
        </div>

        {!isFounder && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Mandate</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(record as InvestorRecord).mandate.map((m, i) => (
                <span key={i} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{m}</span>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              KYC: <span className="font-medium text-slate-700">{(record as InvestorRecord).kyc}</span> ·
              {" "}{(record as InvestorRecord).indicatedCount} indicated interest{(record as InvestorRecord).indicatedCount === 1 ? "" : "s"}
            </p>
          </div>
        )}

        <div className="text-xs text-slate-500">
          Owner <span className="font-medium text-slate-700">{record.ownerInitials}</span> · last activity {fmtDate(record.lastActivity)}
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {isFounder ? "Matching investors" : "Matching open raises"}
          </p>
          {matchLoading ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading matches…</div>
          ) : matches && matches.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {matches.map((m, i) => (
                <li key={i} className="rounded-lg border border-slate-100 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-slate-900">{m.name}</span>
                    <InterestPill level={m.interest} />
                  </div>
                  <div className="mt-0.5 flex items-center justify-between">
                    <span className="truncate text-xs text-slate-500">{m.context}</span>
                    <span className="text-xs font-semibold" style={{ color: BLUE }}>{m.fit}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-400">No platform matches yet.</p>
          )}
          <p className="mt-3 text-[10px] leading-relaxed text-slate-400">{NON_BINDING_NOTE}</p>
        </div>
      </div>
    </div>
  );
}
