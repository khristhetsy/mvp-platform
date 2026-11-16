"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CAP_OPTIONS, NETWORK_DEFAULTS, WAIT_OPTIONS, estimateMinutes, pacing, summarize,
  type GroupNetwork, type ShareItem, type SocialGroup,
} from "@/lib/social/group-share";

type Run = { id: string; network: GroupNetwork; body: string; vary_opening: boolean; wait_minutes: number; daily_cap: number; items: ShareItem[] };
type Staff = { id: string; name: string };
type Loaded = { groups: SocialGroup[]; staff: Staff[]; me: string; run: Run | null; error?: string };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const field = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px]";
const smallBtn = "rounded-md border border-slate-200 bg-white px-2 py-1 text-[11.5px] font-medium text-slate-600 hover:bg-slate-50";

/**
 * The groups block inside Compose. Neither Facebook nor LinkedIn lets us post to a group
 * for you, so each row is: Copy and open, you tap Post there, then Mark posted. The server
 * enforces the wait time and daily limit. Each group gets its own tracked link.
 */
export function GroupShare({ network, body, onResults, onDisabled }: { network: GroupNetwork; body: string; onResults: () => void; onDisabled: () => void }) {
  const label = NETWORK_DEFAULTS[network].label;
  const [groups, setGroups] = useState<SocialGroup[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [me, setMe] = useState<string>("");
  const [run, setRun] = useState<Run | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [wait, setWait] = useState<number>(NETWORK_DEFAULTS[network].wait);
  const [cap, setCap] = useState<number>(NETWORK_DEFAULTS[network].cap);
  const [postingAs, setPostingAs] = useState<string>("owner");   // "owner" = each group's owner, else a staff id
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [manage, setManage] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const disabledRef = useRef(onDisabled);   // keep load() stable when the parent re-renders
  useEffect(() => { disabledRef.current = onDisabled; }, [onDisabled]);

  // Fetch only; state is set from the caller's callback so the effect below never sets state synchronously.
  const fetchState = useCallback(async (): Promise<Loaded | null> => {
    const r = await fetch(`/api/admin/social/group-share?network=${network}`).catch(() => null);
    if (!r) return null;
    const j = await r.json().catch(() => ({}));
    if (j.disabled) { disabledRef.current(); return null; }
    if (!r.ok) return { groups: [], staff: [], me: "", run: null, error: (j.error as string | undefined) ?? "Could not load groups." };
    return { groups: j.groups ?? [], staff: j.staff ?? [], me: j.me ?? "", run: j.run ?? null };
  }, [network]);
  const apply = useCallback((d: Loaded | null) => {
    if (!d) return;
    if (d.error) { setMsg(d.error); return; }
    setGroups(d.groups); setStaff(d.staff); setMe(d.me); setRun(d.run);
  }, []);
  const load = useCallback(async () => { apply(await fetchState()); }, [apply, fetchState]);
  useEffect(() => {
    let live = true;
    void fetchState().then((d) => { if (live) apply(d); });
    return () => { live = false; };
  }, [fetchState, apply]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const all = useMemo(() => groups.filter((g) => g.network === network), [groups, network]);
  const mine = useMemo(() => all.filter((g) => g.active), [all]);
  const shown = mine.filter((g) => g.name.toLowerCase().includes(search.trim().toLowerCase()));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function post(payload: Record<string, unknown>) {
    const r = await fetch("/api/admin/social/group-share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, j } as { ok: boolean; j: Record<string, unknown> & { error?: string; run?: Run } };
  }

  async function start() {
    if (!body.trim()) { setMsg("Write your post in step 1 first."); return; }
    if (picked.length === 0) { setMsg("Pick at least one group."); return; }
    setBusy(true); setMsg(null);
    const { ok, j } = await post({ action: "start", network, body, groupIds: picked, waitMinutes: wait, dailyCap: cap, assigneeId: postingAs === "owner" ? undefined : postingAs });
    setBusy(false);
    if (!ok) { setMsg(j.error ?? "Could not start the queue."); return; }
    if (j.run) setRun(j.run);
    setPicked([]);
  }

  async function copyAndOpen(it: ShareItem) {
    if (!run) return;
    // Open the tab now (inside the click) so the browser allows it, then point it at the group.
    const tab = window.open("", "_blank");
    setMsg(null);
    const { ok, j } = await post({ action: "open", itemId: it.id });
    if (!ok) { tab?.close(); setMsg(j.error ?? "Not yet."); return; }
    try { await navigator.clipboard.writeText(it.text); } catch { setMsg("Could not copy automatically. Select the text and copy it."); }
    if (tab) tab.location.href = it.group_url;
    await load();
  }
  async function act(action: "posted" | "skip" | "removed", it: ShareItem) {
    await post({ action, itemId: it.id });
    await load();
  }

  const items = run?.items ?? [];
  const sum = summarize(items);
  const nextId = items.find((i) => i.status === "waiting" || i.status === "opened")?.id;
  const state = run ? pacing(items.filter((i) => i.opened_at), [], run.wait_minutes, run.daily_cap, now) : null;
  const waitLeft = state && state.reason === "wait" ? Math.max(0, state.waitSeconds) : 0;
  const staffName = (id: string | null) => staff.find((s) => s.id === id)?.name ?? "Unassigned";

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-slate-700">{label}</span>
        <button type="button" onClick={() => setManage((m) => !m)} className="text-[11.5px] font-medium text-indigo-600">{manage ? "Close" : "Manage groups"}</button>
      </div>

      {manage ? <ManageGroups network={network} groups={all} staff={staff} me={me} onChanged={load} /> : null}

      {/* Groups multi select */}
      <div ref={boxRef} className="relative mt-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-[12.5px]">
          <span className="flex min-w-0 flex-1 flex-wrap gap-1">
            {picked.length === 0 ? <span className="text-slate-400">{mine.length === 0 ? "No groups saved yet. Use Manage groups." : "Choose groups"}</span>
              : picked.slice(0, 2).map((id) => <span key={id} className="rounded-full bg-blue-100 px-2 py-0.5 text-[11.5px] font-semibold text-slate-700">{mine.find((g) => g.id === id)?.name}</span>)}
            {picked.length > 2 ? <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11.5px] font-semibold text-slate-700">+{picked.length - 2} more</span> : null}
          </span>
          <span aria-hidden="true">▾</span>
        </button>
        {open ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center gap-2 border-b border-slate-100 p-2 text-[11.5px] font-semibold text-indigo-600">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search groups" className={`${field} flex-1 font-normal text-slate-700`} />
              <button type="button" onClick={() => setPicked(shown.map((g) => g.id))}>Select all</button>
              <button type="button" className="text-slate-500" onClick={() => setPicked([])}>Clear</button>
            </div>
            {shown.map((g) => (
              <label key={g.id} className="flex cursor-pointer items-center gap-2.5 border-t border-slate-50 px-3 py-2 hover:bg-slate-50">
                <input type="checkbox" checked={picked.includes(g.id)} onChange={() => toggle(g.id)} />
                <span className="min-w-0 text-[12.5px]">
                  <b className="block truncate font-semibold text-slate-800">{g.name}</b>
                  <small className="text-slate-500">{g.members ? `${g.members.toLocaleString()} members · ` : ""}{g.owner_name ?? "No owner"}{g.needs_approval ? " · Approval" : ""}</small>
                </span>
              </label>
            ))}
            {shown.length === 0 ? <p className="p-3 text-[12px] text-slate-400">No groups match.</p> : null}
          </div>
        ) : null}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 max-sm:grid-cols-2">
        <label className="text-[11.5px] font-semibold text-slate-500">Wait
          <select value={wait} onChange={(e) => setWait(Number(e.target.value))} className={`${field} mt-1 font-normal`}>{WAIT_OPTIONS.map((w) => <option key={w} value={w}>{w} min</option>)}</select>
        </label>
        <label className="text-[11.5px] font-semibold text-slate-500">Max a day
          <select value={cap} onChange={(e) => setCap(Number(e.target.value))} className={`${field} mt-1 font-normal`}>{CAP_OPTIONS.map((c) => <option key={c} value={c}>{c} groups</option>)}</select>
        </label>
        <label className="text-[11.5px] font-semibold text-slate-500 max-sm:col-span-2">Posting as
          <select value={postingAs} onChange={(e) => setPostingAs(e.target.value)} className={`${field} mt-1 font-normal`}>
            <option value="owner">Each group&apos;s owner</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>

      <button type="button" onClick={() => void start()} disabled={busy || picked.length === 0} className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-45">
        Start {label.toLowerCase()} queue{picked.length ? ` (${picked.length})` : ""}
      </button>

      {/* Queue */}
      {run ? (
        <div className="mt-3 border-t border-slate-200 pt-2">
          <div className="text-[12px] text-slate-600"><b>Group queue</b> · {sum.posted} done · {sum.opened + sum.waiting ? 1 : 0} next · {Math.max(0, sum.waiting + sum.opened - 1)} waiting{sum.waiting + sum.opened > 1 ? ` · about ${estimateMinutes(sum.waiting + sum.opened, run.wait_minutes)} min` : ""}</div>
          <div className="my-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-600" style={{ width: `${sum.total ? Math.round(((sum.posted + sum.skipped) / sum.total) * 100) : 0}%` }} /></div>
          {items.map((it) => {
            const isNext = it.id === nextId;
            const mineItem = !it.assignee_id || it.assignee_id === me;
            return (
              <div key={it.id} className="flex flex-wrap items-center gap-2 border-t border-slate-100 py-1.5">
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-800">{it.group_name}{!mineItem ? <small className="ml-1 text-slate-400">{staffName(it.assignee_id)}</small> : null}</span>
                {it.status === "posted" ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${it.removed_at ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{it.removed_at ? "Removed" : `Posted ${new Date(it.posted_at ?? now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}</span> : null}
                {it.status === "skipped" ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Skipped</span> : null}
                {(it.status === "waiting" || it.status === "opened") && isNext && mineItem ? (
                  it.status === "opened" ? (
                    <><button type="button" onClick={() => void act("posted", it)} className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11.5px] font-semibold text-white">Mark posted</button>
                      <button type="button" onClick={() => void copyAndOpen(it)} className={smallBtn}>Copy again</button></>
                  ) : (
                    <button type="button" disabled={waitLeft > 0 || state?.reason === "cap"} onClick={() => void copyAndOpen(it)} className="rounded-md bg-indigo-600 px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:opacity-45">
                      {state?.reason === "cap" ? "Daily limit" : waitLeft > 0 ? `In ${Math.floor(waitLeft / 60)}:${String(waitLeft % 60).padStart(2, "0")}` : "Copy and open"}
                    </button>
                  )
                ) : null}
                {(it.status === "waiting" || it.status === "opened") && !isNext ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Waiting</span> : null}
                {(it.status === "waiting" || it.status === "opened") && mineItem ? <button type="button" onClick={() => void act("skip", it)} className={smallBtn}>Skip</button> : null}
                {it.status === "posted" && !it.removed_at ? <button type="button" onClick={() => void act("removed", it)} className={smallBtn}>Removed</button> : null}
              </div>
            );
          })}
          <button type="button" onClick={onResults} className="mt-2 text-[12px] font-semibold text-indigo-600">See results in Attribution →</button>
        </div>
      ) : null}

      {msg ? <p className="mt-2 text-[12px] text-rose-600" role="alert">{msg}</p> : null}
      <p className="mt-2 rounded-lg border border-orange-200 bg-orange-50 p-2 text-[11.5px] text-amber-800">
        {network === "linkedin" ? "LinkedIn" : "Facebook"} does not allow posting to groups for you. Copy and open copies the text and opens the group. You tap Post.
      </p>
    </div>
  );
}

/** Add, edit and remove saved groups for one network. */
function ManageGroups({ network, groups, staff, me, onChanged }: { network: GroupNetwork; groups: SocialGroup[]; staff: Staff[]; me: string; onChanged: () => Promise<void> }) {
  const empty = { name: "", url: "", members: "", ownerId: me, ruleNote: "", skipDays: [] as number[], needsApproval: false };
  const [f, setF] = useState(empty);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    setErr(null);
    const r = await fetch("/api/admin/social/group-share", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "group_add", network, name: f.name, url: f.url, members: f.members ? Number(f.members) : null, ownerId: f.ownerId || me || null, ruleNote: f.ruleNote || null, skipDays: f.skipDays, needsApproval: f.needsApproval }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error ?? "Could not save."); return; }
    setF({ ...empty, ownerId: me }); await onChanged();
  }
  async function patch(groupId: string, body: Record<string, unknown>) {
    await fetch("/api/admin/social/group-share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "group_update", groupId, ...body }) });
    await onChanged();
  }
  async function remove(groupId: string) {
    if (!confirm("Remove this group from the list? Past results stay in Attribution only while the group exists.")) return;
    await fetch("/api/admin/social/group-share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "group_remove", groupId }) });
    await onChanged();
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5">
      {groups.map((g) => (
        <div key={g.id} className="flex items-center gap-2 border-b border-slate-100 py-1.5 text-[12.5px]">
          <span className="min-w-0 flex-1"><b className="block truncate font-semibold text-slate-800">{g.name}{g.active ? "" : " (paused)"}</b><small className="text-slate-500">{g.owner_name ?? "No owner"}{g.rule_note ? ` · ${g.rule_note}` : ""}{g.skip_days.length ? ` · skips ${g.skip_days.map((d) => DAYS[d]).join(", ")}` : ""}</small></span>
          <select value={g.owner_id ?? ""} onChange={(e) => void patch(g.id, { ownerId: e.target.value || null })} className="rounded-md border border-slate-200 px-1.5 py-1 text-[11.5px]" aria-label="Owner">
            <option value="">No owner</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="button" onClick={() => void patch(g.id, { active: !g.active })} className={smallBtn}>{g.active ? "Pause" : "Resume"}</button>
          <button type="button" onClick={() => void remove(g.id)} className={smallBtn}>Remove</button>
        </div>
      ))}
      <p className="mt-2 text-[12px] font-semibold text-slate-700">Add group</p>
      <div className="mt-1 grid grid-cols-2 gap-2 max-sm:grid-cols-1">
        <input className={field} placeholder="Group link" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
        <input className={field} placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className={field} placeholder="Members (optional)" inputMode="numeric" value={f.members} onChange={(e) => setF({ ...f, members: e.target.value.replace(/\D/g, "") })} />
        <select className={field} value={f.ownerId || me} onChange={(e) => setF({ ...f, ownerId: e.target.value })} aria-label="Owner">{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <input className={`${field} col-span-2 max-sm:col-span-1`} placeholder="Rules note (optional)" value={f.ruleNote} onChange={(e) => setF({ ...f, ruleNote: e.target.value })} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px] text-slate-600">
        <span>Skip days:</span>
        {DAYS.map((d, i) => <button key={d} type="button" onClick={() => setF({ ...f, skipDays: f.skipDays.includes(i) ? f.skipDays.filter((x) => x !== i) : [...f.skipDays, i] })} className={`rounded-full border px-2 py-0.5 ${f.skipDays.includes(i) ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200"}`}>{d}</button>)}
        <label className="ml-2 flex items-center gap-1"><input type="checkbox" checked={f.needsApproval} onChange={(e) => setF({ ...f, needsApproval: e.target.checked })} />Admin approval needed</label>
      </div>
      {err ? <p className="mt-1 text-[12px] text-rose-600">{err}</p> : null}
      <button type="button" onClick={() => void add()} disabled={!f.name.trim() || !f.url.trim()} className="mt-2 rounded-md bg-indigo-600 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-45">Save group</button>
    </div>
  );
}
