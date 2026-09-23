"use client";

/**
 * Create project — step 1 of 2 (then matching). Starts from a closed-won Sales Hub deal
 * (or a founder company when there's no deal), sets owner / start / term / portal
 * visibility, previews the generated month + week milestones, then creates the project
 * and lands on its pipeline with "Add matches" open.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { generateMilestones, formatRange, TERM_OPTIONS } from "@/lib/ir/milestones";

type Source = { id: string; title: string; contact_name: string | null; contact_crm_id: string | null; company_id: string | null; won_at: string };
type Company = { id: string; name: string; founder_name: string | null };
type Staff = { id: string; name: string };

const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-indigo-400 focus:outline-none";
const lbl = "mb-1 block text-[11.5px] font-medium text-slate-600";

export function NewProjectClient({ meId }: { meId: string }) {
  const router = useRouter();
  const [sources, setSources] = useState<Source[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [mode, setMode] = useState<"deal" | "company">("deal");
  const [sourceId, setSourceId] = useState("");
  const [companyId, setCompanyId] = useState("");
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
    fetch("/api/admin/ir/projects").then((r) => r.json()).then((j) => {
       
      setSources(j.sources ?? []); setCompanies(j.companies ?? []); setStaff(j.staff ?? []);
      if (!(j.sources ?? []).length) setMode("company");
    }).catch(() => setError("Couldn't load Sales Hub deals."));
  }, []);

  const source = sources.find((s) => s.id === sourceId) ?? null;
  const company = companies.find((c) => c.id === companyId) ?? null;
  function pickSource(id: string) {
    setSourceId(id);
    const s = sources.find((x) => x.id === id);
    if (s) { setTitle(s.title.replace(/\s*[·—-]\s*closed won$/i, "")); setFounderName(s.contact_name ?? ""); }
  }
  function pickCompany(id: string) {
    setCompanyId(id);
    const c = companies.find((x) => x.id === id);
    if (c) { setTitle(c.name); setFounderName(c.founder_name ?? ""); }
  }

  const drafts = useMemo(() => (/^\d{4}-\d{2}-\d{2}$/.test(startDate) ? generateMilestones(startDate, term) : []), [startDate, term]);
  const months = drafts.filter((d) => d.kind === "month");

  async function create(force = false) {
    if (!title.trim()) { setError("Give the project a title."); return; }
    if (mode === "deal" && !source) { setError("Pick the closed-won deal this project starts from."); return; }
    if (mode === "company" && !company) { setError("Pick the founder company."); return; }
    setBusy(true); setError(null); setConflict(null);
    try {
      const body = {
        companyId: mode === "deal" ? source?.company_id ?? null : company?.id ?? null,
        founderContactId: mode === "deal" ? source?.contact_crm_id ?? null : null,
        sourceOpportunityId: mode === "deal" ? source?.id ?? null : null,
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
        <p className="mt-1 text-[12.5px] text-slate-500">Starts from a closed deal in Sales Hub. Milestones are generated from the start date and term.</p>

        <div className="mt-4 flex gap-1 rounded-lg bg-slate-100 p-0.5 text-[12px]">
          {(["deal", "company"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`flex-1 rounded-md px-2 py-1 ${mode === m ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-500"}`}>{m === "deal" ? "From a closed-won deal" : "From a founder company"}</button>
          ))}
        </div>

        {mode === "deal" ? (
          <div className="mt-3">
            <label className={lbl}>Closed deal from Sales Hub</label>
            <select value={sourceId} onChange={(e) => pickSource(e.target.value)} className={inp}>
              <option value="">Select a closed-won deal…</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.title}{s.contact_name ? ` · ${s.contact_name}` : ""} · Closed won {new Date(s.won_at).toLocaleDateString()}</option>)}
            </select>
            {!sources.length ? <p className="mt-1 text-[11.5px] text-slate-400">No closed-won deals without a project. Switch to &ldquo;From a founder company&rdquo;.</p> : null}
          </div>
        ) : (
          <div className="mt-3">
            <label className={lbl}>Founder company</label>
            <select value={companyId} onChange={(e) => pickCompany(e.target.value)} className={inp}>
              <option value="">Select a company…</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}{c.founder_name ? ` · ${c.founder_name}` : ""}</option>)}
            </select>
          </div>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><label className={lbl}>Project title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Doyle Organics" className={inp} /></div>
          <div><label className={lbl}>Founder</label><input value={founderName} onChange={(e) => setFounderName(e.target.value)} placeholder="Michael Doyle" className={inp} /></div>
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
