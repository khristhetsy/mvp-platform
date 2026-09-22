"use client";

import { useMemo, useState } from "react";
import {
  diffFieldSets,
  keyIsLocked,
  resolvedOptionsFor,
  validateFieldSet,
  type FieldKind,
  type FieldSet,
  type KeyUsage,
  type SharedOption,
  type StoredField,
} from "@/lib/icfo-events/registration-field-sets";

type VersionRow = {
  id: string; version: string; isActive: boolean;
  reason: string | null; createdAt: string; createdByName: string | null;
};

const KINDS: { value: FieldKind; label: string }[] = [
  { value: "select", label: "Select (one)" },
  { value: "chips", label: "Chips (many)" },
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long text" },
  { value: "checkbox", label: "Checkbox" },
];

const panel = "rounded-xl border border-slate-200 bg-white overflow-hidden";
const btn = "rounded-lg px-3 py-1.5 text-[12.3px] font-semibold whitespace-nowrap";
const inp = "w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.3px] text-slate-700";
const lbl = "block text-[10.6px] font-semibold text-slate-600 mb-1";

function fmt(iso: string): string {
  try { return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return "—"; }
}

/**
 * Edit the registration questions.
 *
 * Two rules the UI enforces rather than merely mentions:
 *   · a key that has been answered cannot be renamed — answers live in
 *     registrations.answers keyed by it, so a rename strands them;
 *   · a field whose options are linked to a shared list (sectors, countries)
 *     can't have those labels retyped here, or that list would fork. Which of
 *     them the question offers is a separate choice, and that one is editable.
 */
export function RegistrationFieldsEditor({
  initialSet,
  usage,
  linked,
  versions,
}: Readonly<{
  initialSet: FieldSet;
  usage: KeyUsage;
  linked: { sectors: SharedOption[]; countries: SharedOption[] };
  versions: VersionRow[];
}>) {
  const [set, setSet] = useState<FieldSet>(initialSet);
  const [tab, setTab] = useState<string>("common");
  const [editing, setEditing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const fields = tab === "common" ? set.common : set.byType[tab] ?? [];
  const errors = useMemo(() => validateFieldSet(set), [set]);
  const changes = useMemo(() => diffFieldSets(initialSet, set, usage), [initialSet, set, usage]);
  const dirty = changes.length > 0;

  function writeFields(next: StoredField[]) {
    setSet((s) => (tab === "common"
      ? { ...s, common: next }
      : { ...s, byType: { ...s.byType, [tab]: next } }));
  }

  function patchField(index: number, patch: Partial<StoredField>) {
    writeFields(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function move(index: number, by: number) {
    const next = [...fields];
    const to = index + by;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    writeFields(next);
  }

  /**
   * Turn one linked option on or off. All-on is stored as no `include` at all
   * rather than a list of every value, so a set that offers everything reads
   * the same as one saved before this existed.
   */
  function toggleIncluded(index: number, all: SharedOption[], value: string) {
    const f = fields[index];
    const current = f.include ?? all.map((o) => o.value);
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    patchField(index, { include: next.length === all.length ? undefined : next });
  }

  function addField() {
    const n = fields.length + 1;
    writeFields([...fields, { key: `question${n}`, label: `Question ${n}`, kind: "text" }]);
    setEditing(`question${n}`);
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/events/registration-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ set, reason }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; version?: string };
      if (!res.ok) { setErr(body.error ?? "Could not save."); return; }
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function revert(id: string) {
    setBusy(true);
    try {
      await fetch("/api/admin/events/registration-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activateId: id }),
      });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className={panel}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-3.5 py-2">
          <p className="text-[11px] font-semibold text-slate-600">Registration fields</p>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.3px] font-semibold text-slate-600">
            Active · {set.version}
          </span>
          <span className="flex-1" />
          <button type="button" onClick={() => setShowHistory((v) => !v)}
            className={`${btn} border border-slate-200 text-slate-600 hover:bg-slate-50`}>
            History
          </button>
        </div>

        <div className="px-3.5 pt-3">
          <div className="flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-lg bg-slate-100 p-0.5">
            {[{ key: "common", label: "Everyone" }, ...set.roles].map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => { setTab(r.key); setEditing(null); }}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[12.2px] font-medium ${
                  tab === r.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="mb-2 mt-2 text-[10.8px] text-slate-500">
            {tab === "common"
              ? "The shared block — everyone answers these, whatever they register as."
              : "Extra questions for this attendee type only."}
          </p>
        </div>

        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {fields.map((f, i) => {
            const locked = keyIsLocked(f.key, usage);
            const isLinked = Boolean(f.optionsFrom);
            const all = isLinked ? linked[f.optionsFrom as "sectors" | "countries"] ?? [] : [];
            const opts = resolvedOptionsFor(f);
            const open = editing === f.key;
            return (
              <li key={`${f.key}-${i}`}>
                <div className={`flex flex-wrap items-center gap-2 px-3.5 py-2 ${open ? "bg-indigo-50/40" : ""}`}>
                  <span className="flex flex-none flex-col leading-none">
                    <button type="button" aria-label="Move up" onClick={() => move(i, -1)}
                      className="text-[9px] text-slate-300 hover:text-slate-600">▲</button>
                    <button type="button" aria-label="Move down" onClick={() => move(i, 1)}
                      className="text-[9px] text-slate-300 hover:text-slate-600">▼</button>
                  </span>
                  <span className="min-w-[150px] flex-none text-[12.4px] font-medium text-slate-800">{f.label}</span>
                  <code className="min-w-[100px] flex-none font-mono text-[10.4px] text-slate-400">{f.key}</code>
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10.2px] font-semibold text-indigo-700">
                    {KINDS.find((k) => k.value === f.kind)?.label ?? f.kind}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-slate-500">
                    {opts.join(" · ") || "—"}
                  </span>
                  {isLinked ? (
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10.2px] font-semibold text-sky-700">
                      {opts.length === all.length ? `All ${all.length}` : `${opts.length} of ${all.length}`}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.2px] font-semibold text-slate-600">
                    {f.kind === "checkbox" ? "Optional" : f.required ? "Required" : "Optional"}
                  </span>
                  <button type="button" onClick={() => setEditing(open ? null : f.key)}
                    className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
                    {open ? "Close" : "Edit"}
                  </button>
                </div>

                {open ? (
                  <div className="border-t border-slate-100 bg-slate-50/60 px-3.5 py-3 pl-10">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className={lbl} htmlFor={`lab-${f.key}`}>Label — what registrants see</label>
                        <input id={`lab-${f.key}`} className={inp} value={f.label}
                          onChange={(e) => patchField(i, { label: e.target.value })} />
                        <p className="mt-1 text-[10.4px] text-slate-500">
                          Safe to change at any time. Nothing stored depends on it.
                        </p>
                      </div>
                      <div>
                        <label className={lbl} htmlFor={`key-${f.key}`}>Key — where the answer is stored</label>
                        <input id={`key-${f.key}`} className={`${inp} ${locked ? "bg-slate-100 text-slate-500" : ""}`}
                          value={f.key} disabled={locked}
                          onChange={(e) => patchField(i, { key: e.target.value.trim() })} />
                        <p className="mt-1 text-[10.4px] text-slate-500">
                          {locked ? (
                            <>
                              <b className="text-amber-700">Locked — {usage[f.key]} answered.</b> Renaming it
                              would strand every one of those answers.
                            </>
                          ) : (
                            "Nothing has been answered under this key yet, so it's still safe to change."
                          )}
                        </p>
                      </div>
                    </div>

                    {(f.kind === "select" || f.kind === "chips") ? (
                      <div className="mt-3">
                        <span className={lbl}>Options — which {f.optionsFrom ?? "values"} this question offers</span>
                        {isLinked ? (
                          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2">
                              <span className="text-[11.4px] text-slate-600">
                                Shared <b className="text-slate-800">{f.optionsFrom}</b> list · {all.length} values
                              </span>
                              <span className="flex-1" />
                              <button type="button" onClick={() => patchField(i, { include: undefined })}
                                className="text-[11px] font-semibold text-sky-700 underline hover:text-sky-900">
                                Select all
                              </button>
                              <span className="text-slate-300">·</span>
                              <button type="button" onClick={() => patchField(i, { include: [] })}
                                className="text-[11px] font-semibold text-sky-700 underline hover:text-sky-900">
                                Clear
                              </button>
                            </div>
                            <div className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-4">
                              {all.map((o) => {
                                const on = opts.includes(o.label);
                                return (
                                  <label key={o.value}
                                    className={`flex cursor-pointer items-center gap-2 bg-white px-3 py-2 text-[12px] ${
                                      on ? "text-slate-700" : "text-slate-400"
                                    }`}>
                                    <input type="checkbox" checked={on}
                                      onChange={() => toggleIncluded(i, all, o.value)}
                                      className="h-3.5 w-3.5 flex-none accent-[var(--navy)]" />
                                    <span className="min-w-0 truncate">{o.label}</span>
                                    {o.value !== o.label ? (
                                      <code className="ml-auto font-mono text-[9.5px] text-slate-300">{o.value}</code>
                                    ) : null}
                                  </label>
                                );
                              })}
                            </div>
                            <p className="border-t border-slate-100 bg-slate-50/70 px-3 py-2 text-[10.4px] text-slate-500">
                              Labels come from the shared list and can&rsquo;t be retyped here — event tracks, company
                              industries and matching read the same values, and a copy would let them drift apart.
                              Unticking one stops it being offered from the moment you save; registrations that
                              already chose it keep their answer.
                            </p>
                          </div>
                        ) : (
                          <>
                            <textarea
                              className={`${inp} font-mono`}
                              rows={3}
                              value={(f.options ?? []).join("\n")}
                              onChange={(e) =>
                                patchField(i, { options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })
                              }
                            />
                            <p className="mt-1 text-[10.4px] text-slate-500">
                              One per line. Removing an option doesn&rsquo;t delete answers that already used
                              it — they stay on the registration and in exports.
                            </p>
                          </>
                        )}
                      </div>
                    ) : null}

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className={lbl} htmlFor={`kind-${f.key}`}>Type</label>
                        <select id={`kind-${f.key}`} className={inp} value={f.kind}
                          onChange={(e) => patchField(i, { kind: e.target.value as FieldKind })}>
                          {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={lbl} htmlFor={`req-${f.key}`}>Required</label>
                        <select id={`req-${f.key}`} className={inp}
                          value={f.required ? "yes" : "no"} disabled={f.kind === "checkbox"}
                          onChange={(e) => patchField(i, { required: e.target.value === "yes" })}>
                          <option value="yes">Required</option>
                          <option value="no">Optional</option>
                        </select>
                        {f.kind === "checkbox" ? (
                          <p className="mt-1 text-[10.4px] text-slate-500">
                            A single yes/no can&rsquo;t sensibly be required.
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button type="button" onClick={() => setEditing(null)}
                        className={`${btn} border border-slate-200 text-slate-600 hover:bg-slate-50`}>Done</button>
                      <span className="flex-1" />
                      <button
                        type="button"
                        onClick={() => { writeFields(fields.filter((_, j) => j !== i)); setEditing(null); }}
                        className={`${btn} border border-red-200 text-red-700 hover:bg-red-50`}
                      >
                        Remove field
                        {locked ? <span className="font-normal"> · keeps {usage[f.key]} answers</span> : null}
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="border-t border-slate-100 px-3.5 py-2.5">
          <button type="button" onClick={addField}
            className={`${btn} border border-slate-200 text-slate-600 hover:bg-slate-50`}>+ Add a question</button>
        </div>
      </div>

      {showHistory ? (
        <div className={panel}>
          <p className="border-b border-slate-100 bg-slate-50 px-3.5 py-2 text-[11px] font-semibold text-slate-600">History</p>
          <ul className="divide-y divide-slate-100">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2 px-3.5 py-2">
                <span className="font-mono text-[11.5px] text-slate-700">{v.version}</span>
                {v.isActive ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.2px] font-semibold text-emerald-700">Active</span>
                ) : null}
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-slate-500">{v.reason ?? "—"}</span>
                <span className="text-[10.5px] text-slate-400">{v.createdByName ?? "—"} · {fmt(v.createdAt)}</span>
                {!v.isActive ? (
                  <button type="button" disabled={busy} onClick={() => void revert(v.id)}
                    className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                    Make active
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dirty ? (
        <div className={panel}>
          <p className="border-b border-slate-100 bg-slate-50 px-3.5 py-2 text-[11px] font-semibold text-slate-600">
            {changes.length} unsaved {changes.length === 1 ? "change" : "changes"}
          </p>
          <div className="px-3.5 py-3">
            <ul className="mb-3 list-disc space-y-1 pl-4">
              {changes.map((c, i) => (
                <li key={i} className="text-[12px] text-slate-600">
                  <span className="text-slate-400">{c.group} · </span>
                  {c.kind === "added" ? <>added <b>{c.label}</b></> : null}
                  {c.kind === "removed" ? (
                    <>
                      removed <b>{c.label}</b>
                      {c.answered > 0 ? (
                        <span className="text-amber-700"> — {c.answered} existing answers are kept, not deleted</span>
                      ) : null}
                    </>
                  ) : null}
                  {c.kind === "changed" ? <><b>{c.label}</b> — {c.what}</> : null}
                  {c.kind === "renamed-key" ? <>key {c.from} → {c.to}</> : null}
                </li>
              ))}
            </ul>

            <p className="mb-3 text-[11.5px] text-slate-500">
              Applies to the public registration form and the admin Register-a-guest form, on{" "}
              <b>every event</b>, from the moment you save. Existing registrations are untouched.
            </p>

            {errors.length ? (
              <ul className="mb-3 list-disc space-y-1 rounded-lg bg-red-50 px-4 py-2 pl-7">
                {errors.map((e) => <li key={e} className="text-[12px] text-red-700">{e}</li>)}
              </ul>
            ) : null}

            <label className={lbl} htmlFor="reason">Why (required)</label>
            <input id="reason" className={inp} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Splitting the top check-size band — too many investors were landing in $2M+." />

            <div className="mt-3 flex items-center gap-2">
              <button type="button" disabled={busy || errors.length > 0 || !reason.trim()} onClick={() => void save()}
                className={`${btn} bg-[var(--navy)] text-white hover:opacity-90 disabled:opacity-50`}>
                {busy ? "Saving…" : "Save as a new version"}
              </button>
              <button type="button" onClick={() => { setSet(initialSet); setReason(""); setEditing(null); }}
                className={`${btn} border border-slate-200 text-slate-600 hover:bg-slate-50`}>
                Discard changes
              </button>
              {err ? <span className="text-[12px] text-red-600">{err}</span> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
