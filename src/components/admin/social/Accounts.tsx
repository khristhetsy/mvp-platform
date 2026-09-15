"use client";

/**
 * Social Hub › Settings › Accounts — every account Social Hub can publish from.
 * Table (label, assignee, status, expiry, ⋯ menu) → row click opens a right-hand drawer
 * (token warning + reconnect, label / assignee / default, 30-day activity, recent posts,
 * disconnect). "Add account" opens a dialog that starts the platform's own OAuth sign-in
 * (or emails a one-time connect link). Passwords never touch iCapOS.
 */
import { useEffect, useRef, useState } from "react";
import type { SocialAccount } from "@/lib/social/queries";
import { accountName } from "@/lib/social/account-name";

type Invite = { id: string; platform: string; label: string | null; assigned_to: string | null; email: string; is_default: boolean; expires_at: string };
type Staff = { id: string; name: string; email: string | null };
type Activity = { published30: number; queued: number; failed30: number; recent: Array<{ id: string; body: string; status: string; at: string | null; url: string | null }> };
type Platform = "linkedin" | "facebook";

const card = "rounded-xl border border-slate-200 bg-white";
const PLATFORM: Record<string, { label: string; icon: string; color: string; kind: string }> = {
  linkedin: { label: "LinkedIn", icon: "ti-brand-linkedin", color: "#0A66C2", kind: "personal profile" },
  facebook: { label: "Facebook", icon: "ti-brand-facebook", color: "#1877F2", kind: "Page" },
};
const STATUS: Record<string, { label: string; cls: string }> = {
  connected: { label: "Connected", cls: "bg-emerald-50 text-emerald-700" },
  expiring: { label: "Expiring", cls: "bg-amber-50 text-amber-700" },
  expired: { label: "Reconnect", cls: "bg-rose-50 text-rose-700" },
  invited: { label: "Invite sent", cls: "bg-slate-100 text-slate-600" },
};
const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 focus:border-indigo-400 focus:outline-none";
const btn = "rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const btnPrimary = "rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50";

const daysUntil = (iso: string | null) => (iso ? Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000) : null);
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—");
function startHref(platform: Platform, opts: { label?: string; assign?: string; isDefault?: boolean; fresh?: boolean }) {
  const p = new URLSearchParams();
  if (opts.label) p.set("label", opts.label);
  if (opts.assign) p.set("assign", opts.assign);
  if (opts.isDefault) p.set("default", "1");
  if (opts.fresh) p.set("fresh", "1");
  const q = p.toString();
  return `/api/social/${platform}/start${q ? `?${q}` : ""}`;
}

export function Accounts({ accounts: initial, linkedInReady, facebookReady, failed24 }: { accounts: SocialAccount[]; linkedInReady: boolean; facebookReady: boolean; failed24: number }) {
  const [accounts, setAccounts] = useState<SocialAccount[]>(initial);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const ready: Record<Platform, boolean> = { linkedin: linkedInReady, facebook: facebookReady };

  async function reload() {
    const r = await fetch("/api/admin/social/accounts");
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error ?? "Couldn't load accounts."); return; }
    setAccounts(d.accounts ?? []); setInvites(d.invites ?? []); setStaff(d.staff ?? []); setError(null);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reload() only sets state after its fetch resolves
  useEffect(() => { void reload(); }, []);
  useEffect(() => { if (!menuId) return; const close = () => setMenuId(null); document.addEventListener("click", close); return () => document.removeEventListener("click", close); }, [menuId]);

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    const r = await fetch("/api/admin/social/accounts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error ?? "Couldn't update the account."); return false; }
    await reload(); return true;
  }
  async function cancelInvite(id: string) {
    const r = await fetch(`/api/admin/social/accounts?invite=${id}`, { method: "DELETE" });
    if (!r.ok) { setError("Couldn't cancel the invite."); return; }
    await reload();
  }
  async function resendInvite(inv: Invite) {
    const r = await fetch("/api/admin/social/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform: inv.platform, label: inv.label, assignedTo: inv.assigned_to, email: inv.email, isDefault: inv.is_default }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error ?? "Couldn't resend the invite."); return; }
    setNotice(d.sent ? `Connect link re-sent to ${inv.email}.` : `Email isn't configured — share this link with ${inv.email}: ${d.link}`);
    await reload();
  }

  const attention = accounts.filter((a) => a.status === "expiring" || a.status === "expired").length;
  const open = openId ? accounts.find((a) => a.id === openId) ?? null : null;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3">
        <p className="text-[13px] font-medium text-slate-700">Accounts</p>
        <span className="text-[11.5px] text-slate-400">{accounts.length} connected{attention ? ` · ${attention} need${attention === 1 ? "s" : ""} attention` : ""}{invites.length ? ` · ${invites.length} invited` : ""}</span>
        <button type="button" onClick={() => setAdding(true)} className={`${btnPrimary} ml-auto inline-flex items-center gap-1.5`}><i className="ti ti-plus" aria-hidden="true" /> Add account</button>
      </div>

      {error ? <div role="alert" className="mt-2 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700"><i className="ti ti-alert-triangle" aria-hidden="true" /><span className="flex-1">{error}</span><button type="button" onClick={() => setError(null)} className="text-rose-700"><i className="ti ti-x" aria-hidden="true" /></button></div> : null}
      {notice ? <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800"><i className="ti ti-circle-check" aria-hidden="true" /><span className="flex-1 break-all">{notice}</span><button type="button" onClick={() => setNotice(null)} className="text-emerald-800"><i className="ti ti-x" aria-hidden="true" /></button></div> : null}

      <div className={`${card} mt-2 overflow-visible`}>
        <table className="w-full table-fixed text-[13px]">
          <colgroup><col className="w-[38%]" /><col className="w-[24%]" /><col className="w-[18%]" /><col className="w-[12%]" /><col className="w-[8%]" /></colgroup>
          <thead><tr className="text-left text-[11.5px] text-slate-500"><th className="px-3 py-2 font-medium">Account</th><th className="px-2 py-2 font-medium">Assigned to</th><th className="px-2 py-2 font-medium">Status</th><th className="px-2 py-2 font-medium">Expires</th><th /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.length === 0 && invites.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-[13px] text-slate-400">No accounts connected yet.</td></tr> : null}
            {accounts.map((a) => {
              const meta = PLATFORM[a.platform]; const st = STATUS[a.status] ?? { label: a.status, cls: "bg-slate-100 text-slate-600" }; const d = daysUntil(a.token_expires_at);
              return (
                <tr key={a.id} onClick={() => setOpenId(a.id)} className={`cursor-pointer hover:bg-slate-50 ${openId === a.id ? "bg-indigo-50/40" : ""}`}>
                  <td className="truncate px-3 py-2.5">
                    <span className="mr-2 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full align-middle text-[12px] text-white" style={{ background: meta?.color ?? "#64748b" }}><i className={`ti ${meta?.icon ?? "ti-world"}`} aria-hidden="true" /></span>
                    <span className="font-medium text-slate-900">{accountName(a)}</span>
                    {a.is_default ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-600">Default</span> : null}
                    {a.platform === "facebook" ? <span className="ml-2 text-[11px] text-slate-400">Page</span> : null}
                  </td>
                  <td className="truncate px-2 py-2.5 text-slate-700">{a.assigned_name ?? "—"}</td>
                  <td className="px-2 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span></td>
                  <td className="px-2 py-2.5 text-slate-600">{d == null ? "—" : d <= 0 ? "expired" : `${d}d`}</td>
                  <td className="relative px-2 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button type="button" aria-label="Account actions" onClick={() => setMenuId(menuId === a.id ? null : a.id)} className="rounded px-1.5 text-slate-500 hover:bg-slate-100"><i className="ti ti-dots" aria-hidden="true" /></button>
                    {menuId === a.id ? (
                      <div className="absolute right-2 top-9 z-20 w-44 rounded-lg border border-slate-200 bg-white py-1 text-left text-[12.5px] shadow-md">
                        {!a.is_default ? <MenuItem icon="ti-star" onClick={() => patch({ id: a.id, isDefault: true })}>Set as default</MenuItem> : <MenuItem icon="ti-star-off" onClick={() => patch({ id: a.id, isDefault: false })}>Clear default</MenuItem>}
                        <MenuItem icon="ti-edit" onClick={() => setOpenId(a.id)}>Rename / reassign</MenuItem>
                        {meta && ready[a.platform as Platform] ? <MenuItem icon="ti-refresh" href={startHref(a.platform as Platform, { fresh: true })}>Reconnect</MenuItem> : null}
                        <MenuItem icon="ti-plug-off" danger onClick={() => setOpenId(a.id)}>Disconnect…</MenuItem>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {invites.map((inv) => {
              const meta = PLATFORM[inv.platform]; const who = staff.find((s) => s.id === inv.assigned_to)?.name ?? inv.email;
              return (
                <tr key={inv.id} className="text-slate-400">
                  <td className="truncate px-3 py-2.5">
                    <span className="mr-2 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-slate-300 align-middle text-[12px] text-white"><i className={`ti ${meta?.icon ?? "ti-world"}`} aria-hidden="true" /></span>
                    {inv.label ?? who}
                  </td>
                  <td className="truncate px-2 py-2.5">{who}</td>
                  <td className="px-2 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS.invited.cls}`}>{STATUS.invited.label}</span></td>
                  <td className="px-2 py-2.5">{fmtDate(inv.expires_at)}</td>
                  <td className="relative px-2 py-2.5 text-right">
                    <button type="button" aria-label="Invite actions" onClick={() => setMenuId(menuId === inv.id ? null : inv.id)} className="rounded px-1.5 text-slate-500 hover:bg-slate-100"><i className="ti ti-dots" aria-hidden="true" /></button>
                    {menuId === inv.id ? (
                      <div className="absolute right-2 top-9 z-20 w-44 rounded-lg border border-slate-200 bg-white py-1 text-left text-[12.5px] shadow-md">
                        <MenuItem icon="ti-send" onClick={() => resendInvite(inv)}>Resend link</MenuItem>
                        <MenuItem icon="ti-x" danger onClick={() => cancelInvite(inv.id)}>Cancel invite</MenuItem>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-5 text-[13px] font-medium text-slate-700">API health</p>
      <div className={`${card} mt-2 divide-y divide-slate-100 text-[13px]`}>
        <HealthRow label="LinkedIn Posts API" value={linkedInReady ? "ok" : "not connected"} ok={linkedInReady} />
        <HealthRow label="Facebook Graph API" value={facebookReady ? "ok · v21.0" : "not connected"} ok={facebookReady} />
        <HealthRow label="Failed last 24h" value={String(failed24)} ok={failed24 === 0} />
      </div>
      <p className="mt-2 text-[11.5px] text-slate-400">LinkedIn posts as a personal profile; Facebook posts to a Page feed with the tagged link as a comment. Instagram is off for now.</p>

      {adding ? <AddAccountDialog staff={staff} ready={ready} onClose={() => setAdding(false)} onInvited={(msg) => { setNotice(msg); setAdding(false); void reload(); }} /> : null}
      {open ? <AccountDrawer account={open} staff={staff} ready={ready} onClose={() => setOpenId(null)} onPatch={patch} onDisconnected={(n) => { setOpenId(null); setNotice(n); }} /> : null}
    </div>
  );
}

function MenuItem({ icon, children, onClick, href, danger }: { icon: string; children: React.ReactNode; onClick?: () => void; href?: string; danger?: boolean }) {
  const cls = `flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 ${danger ? "text-rose-600" : "text-slate-700"}`;
  return href ? <a href={href} className={cls}><i className={`ti ${icon}`} aria-hidden="true" />{children}</a>
    : <button type="button" onClick={onClick} className={cls}><i className={`ti ${icon}`} aria-hidden="true" />{children}</button>;
}

function HealthRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-slate-600">{label}</span>
      <span className={ok === undefined ? "font-mono text-slate-500" : ok ? "text-emerald-600" : "text-rose-600"}>{value}</span>
    </div>
  );
}

// ── Add account dialog ──────────────────────────────────────────────────────
function AddAccountDialog({ staff, ready, onClose, onInvited }: { staff: Staff[]; ready: Record<Platform, boolean>; onClose: () => void; onInvited: (msg: string) => void }) {
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [label, setLabel] = useState("");
  const [assign, setAssign] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const meta = PLATFORM[platform];
  const pick = (id: string) => { setAssign(id); const s = staff.find((x) => x.id === id); if (s) { if (!label) setLabel(s.name); if (s.email) setEmail(s.email); } };

  async function invite() {
    if (!email.includes("@")) { setErr("Enter the staff member's email."); return; }
    setBusy(true); setErr(null);
    const r = await fetch("/api/admin/social/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform, label: label || null, assignedTo: assign || null, email, isDefault }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(d.error ?? "Couldn't send the invite."); return; }
    onInvited(d.sent ? `Connect link sent to ${email}. It works once and expires in 7 days.` : `Email isn't configured — share this link with ${email}: ${d.link}`);
  }

  return (
    <Modal onClose={onClose} title="Add account">
      <p className="mb-1 text-[11.5px] text-slate-500">Platform</p>
      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {(["linkedin", "facebook", "instagram", "x"] as const).map((p) => {
          const on = p === platform; const avail = p === "linkedin" || p === "facebook";
          return <button key={p} type="button" disabled={!avail} title={avail ? undefined : "Not available yet"} onClick={() => avail && setPlatform(p)} className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[12.5px] ${on ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"} disabled:opacity-40`}>
            <i className={`ti ti-brand-${p}`} aria-hidden="true" />{p === "x" ? "X" : p[0].toUpperCase() + p.slice(1)}
          </button>;
        })}
      </div>
      <p className="mb-1 text-[11.5px] text-slate-500">Label</p>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={platform === "facebook" ? "iCFO Capital Page" : "Jessica Santos"} className={`${inputCls} mb-3`} />
      <p className="mb-1 text-[11.5px] text-slate-500">Assign to staff member</p>
      <select value={assign} onChange={(e) => pick(e.target.value)} className={`${inputCls} mb-3`}>
        <option value="">— none —</option>
        {staff.map((s) => <option key={s.id} value={s.id}>{s.name}{s.email ? ` (${s.email})` : ""}</option>)}
      </select>
      <label className="mb-4 flex items-center gap-2 text-[13px] text-slate-700"><input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Make this the default account for new posts</label>

      <p className="mb-1 text-[11.5px] text-slate-500">How to authorize</p>
      <ol className="mb-3 space-y-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-[12.5px] text-slate-700">
        <li><Step n={1} /> Click <b className="font-medium">Connect on {meta.label}</b>. {meta.label} opens its sign-in.</li>
        <li><Step n={2} /> Sign in as this person there — use a private window if someone else is already signed in to {meta.label}. Their password stays with {meta.label}; a security code, if asked, goes to their email.</li>
        <li><Step n={3} /> Click Allow. You land back here with the account listed.</li>
      </ol>
      {!ready[platform] ? <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">{meta.label} isn&rsquo;t configured on this environment yet (missing app credentials), so connecting is disabled.</p> : null}
      {err ? <p className="mb-2 text-[12px] text-rose-600">{err}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <a href={ready[platform] ? startHref(platform, { label, assign, isDefault, fresh: true }) : undefined} aria-disabled={!ready[platform]} className={`${btnPrimary} inline-flex items-center gap-1.5 ${ready[platform] ? "" : "pointer-events-none opacity-50"}`} style={{ background: meta.color }}>
          <i className="ti ti-external-link" aria-hidden="true" /> Connect on {meta.label}
        </a>
        <div className="flex flex-1 items-center gap-1.5">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" className={`${inputCls} min-w-0 flex-1`} />
          <button type="button" onClick={invite} disabled={busy || !ready[platform]} className={`${btn} inline-flex shrink-0 items-center gap-1.5`}><i className="ti ti-mail" aria-hidden="true" /> {busy ? "Sending…" : "Email connect link"}</button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">The connect link lets the staff member authorize from their own computer. It works once and expires in 7 days.</p>
    </Modal>
  );
}

function Step({ n }: { n: number }) {
  return <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-50 align-middle text-[10px] font-semibold text-indigo-700">{n}</span>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center"><p className="text-[15px] font-semibold text-slate-900">{title}</p><button type="button" aria-label="Close" onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600"><i className="ti ti-x" aria-hidden="true" /></button></div>
        {children}
      </div>
    </div>
  );
}

// ── Account drawer ──────────────────────────────────────────────────────────
function AccountDrawer({ account: a, staff, ready, onClose, onPatch, onDisconnected }: {
  account: SocialAccount; staff: Staff[]; ready: Record<Platform, boolean>; onClose: () => void;
  onPatch: (body: Record<string, unknown>) => Promise<boolean>; onDisconnected: (msg: string) => void;
}) {
  const meta = PLATFORM[a.platform];
  const [label, setLabel] = useState(a.label ?? "");
  const [assign, setAssign] = useState(a.assigned_to ?? "");
  const [isDefault, setIsDefault] = useState(a.is_default);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [confirm, setConfirm] = useState<{ queued: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const idRef = useRef(a.id);
  const dirty = label !== (a.label ?? "") || assign !== (a.assigned_to ?? "") || isDefault !== a.is_default;
  const d = daysUntil(a.token_expires_at);

  useEffect(() => {
    if (idRef.current !== a.id) { idRef.current = a.id; setLabel(a.label ?? ""); setAssign(a.assigned_to ?? ""); setIsDefault(a.is_default); setActivity(null); setConfirm(null); }
    let live = true;
    fetch(`/api/admin/social/accounts?activity=${a.id}`).then((r) => r.json()).then((j) => { if (live) setActivity(j.activity ?? null); }).catch(() => { });
    return () => { live = false; };
  }, [a.id, a.label, a.assigned_to, a.is_default]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [onClose]);

  async function save() {
    setSaving(true);
    const ok = await onPatch({ id: a.id, label: label || null, assignedTo: assign || null, isDefault });
    setSaving(false); if (ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
  }
  async function askDisconnect() {
    const r = await fetch(`/api/admin/social/accounts?impact=${a.id}`); const j = await r.json().catch(() => ({}));
    setConfirm({ queued: j.queued ?? 0 });
  }
  async function disconnect() {
    setBusy(true);
    const ok = await onPatch({ id: a.id, disconnect: true });
    setBusy(false);
    if (ok) onDisconnected(`${accountName(a)} disconnected${confirm?.queued ? ` — ${confirm.queued} scheduled post${confirm.queued === 1 ? "" : "s"} skipped` : ""}.`);
  }
  const statusOf = (s: string) => s === "published" ? "bg-emerald-50 text-emerald-700" : s === "queued" ? "bg-blue-50 text-blue-700" : s === "failed" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600";
  const statusLabel = (s: string) => s === "queued" ? "Scheduled" : s[0].toUpperCase() + s.slice(1);

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <aside role="dialog" aria-label={accountName(a)} onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 flex h-full w-full max-w-[440px] flex-col overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full text-[18px] text-white" style={{ background: meta?.color ?? "#64748b" }}><i className={`ti ${meta?.icon ?? "ti-world"}`} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-slate-900">{accountName(a)}</p>
            <p className="truncate text-[12px] text-slate-500">{meta?.label ?? a.platform} · {meta?.kind ?? "account"}{a.display_name && a.display_name !== label ? ` · ${a.display_name}` : ""}</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="text-slate-400 hover:text-slate-600"><i className="ti ti-x" aria-hidden="true" /></button>
        </div>

        {a.status === "expired" || a.status === "expiring" ? (
          <div className={`mt-4 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12.5px] ${a.status === "expired" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800"}`}>
            <i className="ti ti-alert-triangle" aria-hidden="true" />
            <span className="flex-1">{a.status === "expired" ? "Token expired. Scheduled posts from this account will fail until it's reconnected." : `Token expires in ${d} day${d === 1 ? "" : "s"} (${fmtDate(a.token_expires_at)}). Posts after that will fail.`}</span>
            {meta && ready[a.platform as Platform] ? <a href={startHref(a.platform as Platform, { fresh: true })} className={`${btn} shrink-0`}>Reconnect</a> : null}
          </div>
        ) : d != null ? <p className="mt-3 text-[12px] text-slate-500"><i className="ti ti-circle-check text-emerald-600" aria-hidden="true" /> Connected · token renews {fmtDate(a.token_expires_at)} ({d}d)</p> : null}

        <p className="mb-1 mt-4 text-[11.5px] text-slate-500">Label</p>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={a.display_name ?? ""} className={`${inputCls} mb-3`} />
        <p className="mb-1 text-[11.5px] text-slate-500">Assigned to</p>
        <select value={assign} onChange={(e) => setAssign(e.target.value)} className={`${inputCls} mb-3`}>
          <option value="">— none —</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}{s.email ? ` (${s.email})` : ""}</option>)}
        </select>
        <label className="mb-4 flex items-center gap-2 text-[13px] text-slate-700"><input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Default account for new posts</label>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {[["Published (30d)", activity?.published30], ["Scheduled", activity?.queued], ["Failed (30d)", activity?.failed30]].map(([l, v]) => (
            <div key={String(l)} className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-[11px] text-slate-500">{l}</p><p className="text-[18px] font-semibold text-slate-900">{v == null ? "…" : v}</p></div>
          ))}
        </div>

        <p className="mb-1 text-[11.5px] text-slate-500">Recent posts</p>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {!activity ? <p className="px-3 py-3 text-[12px] text-slate-400">Loading…</p>
            : activity.recent.length === 0 ? <p className="px-3 py-3 text-[12px] text-slate-400">Nothing from this account in the last 30 days.</p>
              : activity.recent.map((r) => (
                <div key={r.id} className="flex items-center gap-2 px-3 py-2 text-[12.5px]">
                  <span className="min-w-0 flex-1 truncate text-slate-700">{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="hover:underline">{r.body}</a> : r.body}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${statusOf(r.status)}`}>{statusLabel(r.status)} {fmtDate(r.at)}</span>
                </div>
              ))}
        </div>
        <a href={`/admin/social?tab=library`} className="mt-1.5 inline-block text-[12px] text-indigo-600 hover:underline">View all in Library →</a>

        <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={save} disabled={!dirty || saving} className={btnPrimary}>{saving ? "Saving…" : saved ? "Saved" : "Save"}</button>
          <button type="button" onClick={askDisconnect} className={`${btn} ml-auto border-rose-200 text-rose-600 hover:bg-rose-50`}>Disconnect</button>
        </div>

        {confirm ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[12.5px] text-rose-800">
            <p><b className="font-medium">Disconnect {accountName(a)}?</b> Its token is removed{confirm.queued ? ` and ${confirm.queued} scheduled post${confirm.queued === 1 ? "" : "s"} will be skipped` : ""}. Published posts and their stats are kept. You can reconnect later.</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={disconnect} disabled={busy} className="rounded-lg bg-rose-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50">{busy ? "Disconnecting…" : "Disconnect"}</button>
              <button type="button" onClick={() => setConfirm(null)} className={btn}>Keep</button>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
