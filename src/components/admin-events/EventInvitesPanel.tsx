"use client";

import { useCallback, useEffect, useState } from "react";
import { INVITE_ROLES, INVITE_ROLE_VALUES, type InviteRole } from "@/lib/icfo-events/invite-rules";

type InviteRow = {
  id: string;
  role: InviteRole;
  email: string;
  displayName: string | null;
  status: "invited" | "accepted" | "declined" | "withdrawn";
  materialsDue: string | null;
  invitedAt: string;
  outstanding: string[];
  complete: boolean;
};

type SessionOption = { id: string; title: string };

const card = "rounded-xl border border-slate-200 bg-white";
const lbl = "block text-[11px] font-semibold text-slate-600 mb-1";
const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-700";
const btn = "rounded-lg px-3 py-1.5 text-[12.5px] font-semibold";

const STATUS_CHIP: Record<InviteRow["status"], { label: string; cls: string }> = {
  invited: { label: "Invited", cls: "bg-amber-50 text-amber-700" },
  accepted: { label: "Accepted", cls: "bg-emerald-50 text-emerald-700" },
  declined: { label: "Declined", cls: "bg-red-50 text-red-700" },
  withdrawn: { label: "Withdrawn", cls: "bg-slate-100 text-slate-500" },
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short" });
  } catch {
    return "—";
  }
}

/**
 * Invite founders, showcase presenters and exhibitors to one event, and track
 * what each of them still owes.
 *
 * Roles differ in what they're asked for and where they answer — the rules for
 * both live in `invite-rules.ts`, so this component never decides either.
 */
export function EventInvitesPanel({
  eventId,
  sessions = [],
  canEdit,
}: Readonly<{ eventId: string; sessions?: SessionOption[]; canEdit: boolean }>) {
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<InviteRole>("founder_showcase");
  const [emails, setEmails] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/events/${eventId}/invites`);
      const body = (await res.json().catch(() => ({}))) as { invites?: InviteRow[] };
      if (res.ok) setRows(body.invites ?? []);
    } catch {
      /* the tracker is best-effort; the form still works */
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch sets state after mount
  useEffect(() => { void load(); }, [load]);

  async function send() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails, role,
          sessionId: sessionId || null,
          materialsDue: due || null,
          note: note.trim() || null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        sent?: string[]; failed?: { email: string; reason: string }[]; error?: string;
      };
      if (body.error) { setErr(body.error); return; }
      // Report per address: one duplicate must not hide the ones that worked.
      if (body.sent?.length) {
        setMsg(`Invited ${body.sent.length} ${body.sent.length === 1 ? "person" : "people"}.`);
        setEmails("");
        setNote("");
      }
      if (body.failed?.length) {
        setErr(body.failed.map((f) => `${f.email}: ${f.reason}`).join("  ·  "));
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  const waiting = rows.filter((r) => r.status === "accepted" && !r.complete).length;

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-3.5 py-2">
        <p className="min-w-0 flex-1 text-[11px] font-semibold text-slate-600">
          Presenters &amp; exhibitors
          <span className="font-normal text-slate-400">
            {" "}· {loading ? "loading…" : `${rows.length} invited`}
          </span>
        </p>
        {waiting > 0 ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-800">
            {waiting} waiting on materials
          </span>
        ) : null}
      </div>

      {canEdit ? (
        <div className="border-b border-slate-100 p-3.5">
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <label className={lbl} htmlFor="inv-role">Role</label>
              <select id="inv-role" className={inp} value={role} onChange={(e) => setRole(e.target.value as InviteRole)}>
                {INVITE_ROLE_VALUES.map((r) => (
                  <option key={r} value={r}>{INVITE_ROLES[r].label}</option>
                ))}
              </select>
              <p className="mt-1 text-[10.5px] text-slate-500">{INVITE_ROLES[role].blurb}</p>
            </div>
            <div>
              <label className={lbl} htmlFor="inv-session">Session (optional)</label>
              <select id="inv-session" className={inp} value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
                <option value="">— none —</option>
                {sessions.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl} htmlFor="inv-due">Materials due</label>
              <input id="inv-due" type="date" className={inp} value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>

          <div className="mt-2">
            <label className={lbl} htmlFor="inv-emails">Invite by email</label>
            <textarea
              id="inv-emails"
              className={inp}
              rows={2}
              placeholder="name@company.com, another@company.com"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
            />
            <p className="mt-1 text-[10.5px] text-slate-500">
              A matching iCapOS account is linked automatically and answers in their portal. Anyone
              else gets a signed link and never needs to sign in.
            </p>
          </div>

          <div className="mt-2">
            <label className={lbl} htmlFor="inv-note">Personal note (optional)</label>
            <textarea id="inv-note" className={inp} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || !emails.trim()}
              onClick={() => void send()}
              className={`${btn} bg-[var(--navy)] text-white hover:opacity-90 disabled:opacity-50`}
            >
              {busy ? "Sending…" : "Send invitations"}
            </button>
            {msg ? <span className="text-[12px] font-medium text-emerald-700">{msg}</span> : null}
          </div>
          {err ? <p className="mt-2 text-[12px] text-red-600">{err}</p> : null}
        </div>
      ) : null}

      {rows.length === 0 && !loading ? (
        <p className="px-3.5 py-4 text-[12.5px] text-slate-500">
          Nobody invited yet. Founders and showcase presenters answer in their iCapOS portal;
          exhibitors get a link.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => {
            const chip = STATUS_CHIP[r.status];
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
                <span className="min-w-0 flex-none text-[12.5px] font-medium text-slate-800">
                  {r.displayName ?? r.email}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-slate-500">{r.email}</span>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10.5px] font-semibold text-indigo-700">
                  {INVITE_ROLES[r.role].label}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${chip.cls}`}>{chip.label}</span>
                {r.status === "accepted" ? (
                  r.complete ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">
                      Materials in
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700">
                      {r.outstanding.join(" · ")}
                    </span>
                  )
                ) : null}
                <span className="text-[10.5px] text-slate-400">{fmtDate(r.invitedAt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
