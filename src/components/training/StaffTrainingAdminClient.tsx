"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Invite = { id: string; email: string; audience: string; status: string; expires_at: string; organization_label: string };
type Enr = { id: string; email: string; audience: string; coach_on: boolean; coach_tone: string; done: number; total: number };
type Ex = { id: string; email: string; module_key: string; exercise_index: number; answer: string; ai_feedback: string | null };

async function call(method: string, url: string, body: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(j.error ?? "Request failed.");
}

export function StaffTrainingAdminClient({ invites, enrollments, exercises }: { invites: Invite[]; enrollments: Enr[]; exercises: Ex[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [audience, setAudience] = useState("staff");
  const [org, setOrg] = useState("");
  const [coach, setCoach] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>, ok?: string) {
    setBusy(true); setMsg(null);
    try { await fn(); if (ok) setMsg(ok); router.refresh(); } catch (e) { setMsg(e instanceof Error ? e.message : "Failed."); } finally { setBusy(false); }
  }

  const btn = "rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
  return (
    <div className="space-y-6">
      {msg ? <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{msg}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Invite someone</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-600">Email<input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-64 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></label>
          <label className="text-xs text-slate-600">Audience
            <select value={audience} onChange={(e) => setAudience(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
              <option value="staff">iCFO staff</option><option value="licensee">Licensee user</option>
            </select>
          </label>
          {audience === "licensee" ? <label className="text-xs text-slate-600">Organization<input value={org} onChange={(e) => setOrg(e.target.value)} className="mt-1 block w-48 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></label> : null}
          <label className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={coach} onChange={(e) => setCoach(e.target.checked)} />AI coach on</label>
          <button type="button" disabled={busy || !email.includes("@")} className="rounded-lg bg-[#1A6CE4] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2E78F5] disabled:opacity-50"
            onClick={() => run(async () => { await call("POST", "/api/admin/learning/staff-training/invites", { email, audience, organizationLabel: org, coachEnabled: coach }); setEmail(""); }, "Invitation sent.")}>
            Send invitation
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Invitations ({invites.length})</h2>
        <table className="mt-3 w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="py-1">Email</th><th>Audience</th><th>Status</th><th>Expires</th><th /></tr></thead>
          <tbody className="divide-y divide-slate-100">{invites.map((i) => (
            <tr key={i.id}><td className="py-1.5">{i.email}</td><td>{i.audience === "licensee" ? `Licensee, ${i.organization_label}` : "iCFO staff"}</td><td>{i.status}</td><td>{new Date(i.expires_at).toLocaleDateString()}</td>
              <td className="text-right">{i.status === "invited" ? <button type="button" disabled={busy} className={btn} onClick={() => run(() => call("DELETE", "/api/admin/learning/staff-training/invites", { id: i.id }))}>Revoke</button> : null}</td></tr>
          ))}{invites.length === 0 ? <tr><td colSpan={5} className="py-3 text-slate-500">No invitations yet.</td></tr> : null}</tbody></table>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Trainees ({enrollments.length})</h2>
        <table className="mt-3 w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="py-1">Trainee</th><th>Audience</th><th>Steps done</th><th>Coach</th><th>Style</th><th /></tr></thead>
          <tbody className="divide-y divide-slate-100">{enrollments.map((e) => (
            <tr key={e.id}><td className="py-1.5">{e.email}</td><td>{e.audience}</td><td>{e.done} of {e.total}</td>
              <td><button type="button" disabled={busy} className={btn} onClick={() => run(() => call("PATCH", "/api/admin/learning/staff-training/enrollments", { id: e.id, coachOn: !e.coach_on }))}>{e.coach_on ? "On" : "Off"}</button></td>
              <td><select disabled={busy} value={e.coach_tone} className="rounded border border-slate-300 px-1 py-0.5 text-xs" onChange={(ev) => run(() => call("PATCH", "/api/admin/learning/staff-training/enrollments", { id: e.id, coachTone: ev.target.value }))}>
                <option value="encouraging">Encouraging</option><option value="driven">Driven</option><option value="relentless">Relentless</option></select></td>
              <td className="text-right"><button type="button" disabled={busy} className={btn} onClick={() => run(() => call("PATCH", "/api/admin/learning/staff-training/enrollments", { id: e.id, remove: true }))}>Remove access</button></td></tr>
          ))}{enrollments.length === 0 ? <tr><td colSpan={6} className="py-3 text-slate-500">Nobody has accepted yet.</td></tr> : null}</tbody></table>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Exercises to review ({exercises.length})</h2>
        <div className="mt-3 space-y-3">{exercises.map((x) => (
          <div key={x.id} className="rounded-lg border border-slate-100 p-3 text-sm">
            <p className="text-xs text-slate-500">{x.email} · {x.module_key} · exercise {x.exercise_index + 1}</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-800">{x.answer}</p>
            {x.ai_feedback ? <p className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-600"><span className="font-semibold">AI first pass:</span> {x.ai_feedback}</p> : null}
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" disabled={busy} className={btn} onClick={() => run(() => call("PATCH", "/api/admin/learning/staff-training/exercises", { id: x.id, status: "redo" }))}>Redo</button>
              <button type="button" disabled={busy} className="rounded-lg bg-[#1A6CE4] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#2E78F5] disabled:opacity-50" onClick={() => run(() => call("PATCH", "/api/admin/learning/staff-training/exercises", { id: x.id, status: "pass" }))}>Pass</button>
            </div>
          </div>
        ))}{exercises.length === 0 ? <p className="text-sm text-slate-500">Nothing waiting for review.</p> : null}</div>
      </section>
    </div>
  );
}
