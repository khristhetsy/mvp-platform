"use client";

/**
 * Create project — step 1 of 2 (then matching). Starts from any Founder contact
 * (searchable picker over all Sales Contacts), sets owner / start / term / portal
 * visibility, previews the generated month + week milestones, then creates the project
 * and lands on its pipeline with "Add matches" open.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FounderPicker, type PickedFounder } from "./FounderPicker";
import { generateMilestones, formatRange, TERM_OPTIONS } from "@/lib/ir/milestones";

type Staff = { id: string; name: string };

const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-indigo-400 focus:outline-none";
const lbl = "mb-1 block text-[11.5px] font-medium text-slate-600";

export function NewProjectClient({ meId }: { meId: string }) {
  const router = useRouter();
  const [activeContactIds, setActiveContactIds] = useState<Set<string>>(new Set());
  const [staff, setStaff] = useState<Staff[]>([]);
  const [founder, setFounder] = useState<PickedFounder | null>(null);
  const [title, setTitle] = useState("");
  const [founderName, setFounderName] = useState("");
  const [ownerId, setOwnerId] = useState(meId);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [term, setTerm] = useState<number>(6);
  const [portal, setPortal] = useState(true);
  const [isSpv, setIsSpv] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/ir/projects").then((r) => r.json()).then((j) => setStaff(j.staff ?? [])).catch(() => setError("Couldn't load staff."));
    // Founders that already have an active project get a flag in the picker.
    fetch("/api/admin/ir/projects?status=active").then((r) => r.json()).then((j) => {
      setActiveContactIds(new Set(((j.projects ?? []) as Array<{ founder_contact_id: string | null }>).map((p) => p.founder_contact_id).filter((x): x is string => !!x)));
    }).catch(() => { /* the 409 check on create still enforces the rule */ });
  }, []);

  function pickFounder(f: PickedFounder) {
    setFounder(f);
    setTitle(f.company || f.name);
    setFounderName(f.name);
  }

  const drafts = useMemo(() => (/^\d{4}-\d{2}-\d{2}$/.test(startDate) ? generateMilestones(startDate, term) : []), [startDate, term]);
  const months = drafts.filter((d) => d.kind === "month");

  async function create(force = false) {
    if (!title.trim()) { setError("Give the project a title."); return; }
    if (!founder) { setError("Pick the Founder."); return; }
    setBusy(true); setError(null); setConflict(null);
    try {
      const body = {
        companyId: null,
        founderContactId: founder.id,
        sourceOpportunityId: null,
        title: title.trim(), founderName: founderName.trim() || null, ownerId, startDate, termMonths: term, founderReportVisible: portal, isSpv, force,
      };
      const r = await fetch("/api/admin/ir/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409) { setConflict(j.error ?? "This founder already has an active project."); return; }
      if (!r.ok) { setError(j.error ?? "Couldn't create the project."); return; }
      router.push(`/admin/ir/projects/${j.id}/pipeline?add=1`);
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700">Step 1 of 2 · Project, then matching</p>
        <h2 className="mt-1 text-[20px] font-semibold text-slate-900">Create project</h2>
        <p className="mt-1 text-[12.5px] text-slate-500">Pick any Founder from your contacts. Milestones are generated from the start date and term.</p>

        <div className="mt-4">
          <label className={lbl}>Founder</label>
          <FounderPicker value={founder} onPick={pickFounder} activeContactIds={activeContactIds} />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><label className={lbl}>Project title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Doyle Organics" className={inp} /></div>
          <div><label className={lbl}>Founder name</label><input value={founderName} onChange={(e) => setFounderName(e.target.value)} placeholder="Michael Doyle" className={inp} /></div>
          <div><label className={lbl}>Project owner</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inp}>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label className={lbl}>Start date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Term</label>
            <select value={term} onChange={(e) => setTerm(Number(e.target.value))} className={inp}>{TERM_OPTIONS.map((t) => <option key={t} value={t}>{t} months</option>)}</select>
            <p className="mt-1 text-[11px] text-slate-400">Each month is a 4-week milestone with weekly checkpoints.</p></div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <label className="flex items-start gap-2 text-[12.5px] text-slate-700"><input type="checkbox" checked={portal} onChange={(e) => setPortal(e.target.checked)} className="mt-0.5" />
            <span><b className="font-medium">Founder portal</b> — founder can view the outreach report<br /><span className="text-[11.5px] text-slate-500">Founders see stage counts, meeting dates and firms. Investor phone numbers and emails are never shown.</span></span></label>
          <label className="mt-2 flex items-center gap-2 text-[12.5px] text-slate-700"><input type="checkbox" checked={isSpv} onChange={(e) => setIsSpv(e.target.checked)} /> SPV Program engagement</label>
        </div>

        {error ? <p className="mt-3 text-[12.5px] text-rose-600">{error}</p> : null}
        {conflict ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12.5px] text-amber-800">
            {conflict} Create another anyway?
            <div className="mt-2 flex gap-2"><button type="button" onClick={() => create(true)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-[12px] font-semibold text-white">Yes, create a second project</button><button type="button" onClick={() => setConflict(null)} className="rounded-lg border border-amber-300 px-3 py-1.5 text-[12px]">Cancel</button></div>
          </div>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => router.push("/admin/ir/projects")} className="rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="button" disabled={busy} onClick={() => create(false)} className="rounded-lg bg-indigo-600 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? "Creating…" : "Create and start matching"}</button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-[15px] font-semibold text-slate-900">Milestones generated</h3>
        <p className="text-[12px] text-slate-500">{months.length} months · {drafts.length - months.length} weeks</p>
        <div className="mt-3 space-y-2">
          {months.map((m) => (
            <div key={m.sortOrder} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="flex items-baseline justify-between"><span className="text-[13px] font-medium text-slate-800">{m.label}</span><span className="text-[11.5px] text-slate-500">{formatRange(m.startsOn, m.endsOn)}</span></div>
              <div className="mt-1.5 flex gap-1.5">
                {drafts.filter((w) => w.kind === "week" && w.monthIndex === m.sortOrder).map((w) => <span key={w.sortOrder} title={formatRange(w.startsOn, w.endsOn)} className="rounded bg-white px-2 py-0.5 text-[10.5px] text-slate-600 ring-1 ring-slate-200">W{w.sortOrder}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
