"use client";

import { useEffect, useRef, useState } from "react";
import type { AttendeeType } from "@/lib/icfo-events/registration-intake";
import type { EventRegistrationRow } from "@/lib/icfo-events/registrations";
import {
  type RegistrationField,
  REGISTRATION_ROLES as CODE_ROLES,
  REGISTRATION_COMMON as CODE_COMMON,
  REGISTRATION_BY_TYPE as CODE_BY_TYPE,
} from "@/lib/icfo-events/registration-fields";
import { resolveAll, sectorOptions, type FieldSet } from "@/lib/icfo-events/registration-field-sets";
import { useVocabulary } from "@/lib/vocabulary/provider";
import { mapProfileToFill, type ContactProfileBits } from "@/lib/icfo-events/contact-profile-map";

const isBlank = (v: unknown): boolean => v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === "");

type ContactHit = { id: string; name: string; email: string; company: string; title: string; country: string; phone: string; profile?: ContactProfileBits };

/** Registration types that look the guest up in Contacts (Sponsor does not). */
const LOOKUP_ROLES: AttendeeType[] = ["investor", "founder", "service"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** The typed letters in bold blue inside the suggestion's name. */
function highlight(name: string, q: string) {
  const i = q ? name.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return name;
  return (
    <>
      {name.slice(0, i)}
      <span className="text-[var(--blue)]">{name.slice(i, i + q.length)}</span>
      {name.slice(i + q.length)}
    </>
  );
}

const HIT_FIELD_CLASS = "border-emerald-300 bg-emerald-50/60";
const NEEDS_FIELD_CLASS = "border-amber-300 bg-amber-50/60";

export function EventManualRegister({ eventId, onAdded, onClose, fieldSet }: { eventId: string; onAdded: (r: EventRegistrationRow) => void; onClose: () => void; fieldSet?: FieldSet }) {
  const [role, setRole] = useState<AttendeeType>("investor");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Contacts name lookup: suggestions while typing, then a "linked" state once one is picked.
  const [hits, setHits] = useState<ContactHit[]>([]);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [activeHit, setActiveHit] = useState(0);
  const [linked, setLinked] = useState<string | null>(null); // the picked contact's name
  const [filled, setFilled] = useState<Set<string>>(new Set()); // answer keys filled from Contacts
  const [linkedHit, setLinkedHit] = useState<ContactHit | null>(null); // the picked contact, for re-mapping on a role change
  const [notes, setNotes] = useState<Record<string, string>>({}); // key to "where this came from"
  const [hints, setHints] = useState<Record<string, string>>({}); // key to what the profile says, when it can't be mapped
  const skipNextLookup = useRef(false);
  const nameValue = String(answers.name ?? "");
  const lookupOn = LOOKUP_ROLES.includes(role);

  useEffect(() => {
    const q = nameValue.trim();
    if (skipNextLookup.current) { skipNextLookup.current = false; return; }
    if (!lookupOn || linked || q.length < 2) { setHits([]); setLookupBusy(false); return; }
    const ctl = new AbortController();
    setLookupBusy(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/events/contact-lookup?q=${encodeURIComponent(q)}`, { signal: ctl.signal });
        const json = await res.json().catch(() => ({}));
        setHits(res.ok && Array.isArray(json.contacts) ? (json.contacts as ContactHit[]) : []);
        setActiveHit(0);
      } catch {
        if (!ctl.signal.aborted) setHits([]); // a failed lookup just means no suggestions
      } finally {
        if (!ctl.signal.aborted) setLookupBusy(false);
      }
    }, 250);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [nameValue, lookupOn, linked]);

  // Same source as the public form, so the two can never ask different things.
  const REGISTRATION_ROLES = fieldSet?.roles ?? CODE_ROLES;
  const sectorList = sectorOptions(useVocabulary("industry").options);
  const common: RegistrationField[] = fieldSet ? resolveAll(fieldSet.common, sectorList) : CODE_COMMON;
  const perType: RegistrationField[] = fieldSet
    ? resolveAll(fieldSet.byType[role] ?? [], sectorList)
    : CODE_BY_TYPE[role];
  const fields: RegistrationField[] = [...common, ...perType];

  function set(key: string, value: unknown) {
    setAnswers((a) => ({ ...a, [key]: value }));
    if (key !== "name") dropFilled(key);
  }
  function toggleChip(key: string, opt: string) {
    dropFilled(key);
    setAnswers((a) => {
      const cur = Array.isArray(a[key]) ? (a[key] as string[]) : [];
      return { ...a, [key]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    });
  }

  /** Fill the form from a picked Contact. Only values the Contact has are written. */
  function pickContact(c: ContactHit) {
    const next: Record<string, string> = { name: c.name, company: c.company, title: c.title, email: c.email, phone: c.phone };
    // Country is a fixed list on this form: use the Contact's if it is on it, else "Other".
    const countryField = fields.find((f) => f.key === "country");
    if (c.country && countryField?.options) {
      const opts = countryField.options;
      const hit = opts.find((o) => o.toLowerCase() === c.country.toLowerCase()) ?? opts.find((o) => o === "Other");
      if (hit) next.country = hit;
    }
    // What the profile adds for this registration type (investor type, stages, sectors, ...).
    const pf = mapProfileToFill(role, c.profile, fields);
    setAnswers((a) => {
      const merged: Record<string, unknown> = { ...a };
      for (const [k, v] of Object.entries(next)) if (v) merged[k] = v;
      Object.assign(merged, pf.values);
      return merged;
    });
    setFilled(new Set([...Object.entries(next).filter(([, v]) => v).map(([k]) => k), ...Object.keys(pf.values)]));
    setNotes(pf.notes);
    setHints(pf.hints);
    setLinkedHit(c);
    setLinked(c.name);
    setHits([]);
    setLookupOpen(false);
    setError(null);
  }

  // Switching the registration type while linked: fill what the new type asks for from the
  // same Contact, without overwriting anything already typed.
  useEffect(() => {
    if (!linkedHit) return;
    const pf = mapProfileToFill(role, linkedHit.profile, fields);
    const open = Object.keys(pf.values).filter((k) => isBlank(answers[k]));
    if (open.length > 0) {
      setAnswers((a) => {
        const merged = { ...a };
        for (const k of open) if (isBlank(merged[k])) merged[k] = pf.values[k];
        return merged;
      });
      setFilled((s) => new Set([...s, ...open]));
      setNotes((n) => ({ ...n, ...pf.notes }));
    }
    setHints(pf.hints);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  function clearLink() {
    setLinked(null);
    setLinkedHit(null);
    setFilled(new Set());
    setNotes({});
    setHints({});
  }

  function unlinkContact() {
    skipNextLookup.current = true;
    clearLink();
  }

  /** Editing a field the Contact filled makes it the admin's value, so it loses the green tint. */
  function dropFilled(key: string) {
    setFilled((s) => { if (!s.has(key)) return s; const n = new Set(s); n.delete(key); return n; });
    setNotes((n) => { if (!(key in n)) return n; const { [key]: _drop, ...rest } = n; void _drop; return rest; });
  }

  async function submit() {
    const email = String(answers.email ?? "").trim();
    if (!String(answers.name ?? "").trim()) { setError("Enter the guest's full name."); return; }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setError("Enter a valid email address."); return; }
    if (!String(answers.phone ?? "").trim()) { setError("Enter a phone number."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendeeType: role, answers }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not register the guest.");
      onAdded(json.registration as EventRegistrationRow);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register the guest.");
    } finally {
      setBusy(false);
    }
  }

  function renderField(f: RegistrationField) {
    const label = (
      <span className="mb-1 block text-[11px] text-[var(--text-secondary)]">
        {f.label}{f.required ? <span className="text-rose-500"> *</span> : null}
      </span>
    );
    // Green once the Contact filled it, amber if the Contact left a required one empty.
    const isEmpty = (v: unknown) => v == null || String(v).trim() === "";
    const tint = filled.has(f.key) ? HIT_FIELD_CLASS : linked && f.required && f.kind !== "chips" && isEmpty(answers[f.key]) ? NEEDS_FIELD_CLASS : "border-[var(--border-subtle)]";
    const needsHint = linked && !filled.has(f.key) && f.required && f.kind !== "chips" && isEmpty(answers[f.key]);

    if (f.key === "name" && lookupOn) {
      const listId = "event-contact-lookup-list";
      const showList = lookupOpen && !linked && (lookupBusy || hits.length > 0 || nameValue.trim().length >= 2);
      return (
        <div key={f.key} className="relative block">
          <label htmlFor="event-guest-name">{label}</label>
          <div className="relative">
            <input
              id="event-guest-name"
              type="text"
              role="combobox"
              aria-expanded={showList}
              aria-controls={listId}
              aria-autocomplete="list"
              autoComplete="off"
              value={nameValue}
              onChange={(e) => {
                set("name", e.target.value);
                if (linked) clearLink();
                setLookupOpen(true);
              }}
              onFocus={() => setLookupOpen(true)}
              onBlur={() => setLookupOpen(false)}
              onKeyDown={(e) => {
                if (!showList) return;
                if (e.key === "ArrowDown") { e.preventDefault(); setActiveHit((i) => Math.min(i + 1, Math.max(hits.length - 1, 0))); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setActiveHit((i) => Math.max(i - 1, 0)); }
                else if (e.key === "Enter" && hits[activeHit]) { e.preventDefault(); pickContact(hits[activeHit]); }
                else if (e.key === "Escape") { setLookupOpen(false); }
              }}
              placeholder="Start typing to find a Contact"
              className={`w-full rounded-md border px-2 py-1.5 text-xs ${tint}`}
            />
            {showList && (
              <div id={listId} role="listbox" className="absolute left-0 top-full z-20 mt-1 w-[min(520px,92vw)] overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white shadow-lg">
                <p className="border-b border-[var(--border-subtle)] bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {lookupBusy ? "Searching Contacts…" : hits.length > 0 ? `From Contacts, ${hits.length} match${hits.length === 1 ? "" : "es"}` : "No match in Contacts"}
                </p>
                {hits.map((c, i) => (
                  <div
                    key={c.id}
                    role="option"
                    aria-selected={i === activeHit}
                    tabIndex={-1}
                    onMouseDown={(e) => { e.preventDefault(); pickContact(c); }}
                    onMouseEnter={() => setActiveHit(i)}
                    className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${i === activeHit ? "bg-[var(--indigo-soft)]" : ""}`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${i === activeHit ? "bg-[var(--blue)] text-white" : "bg-slate-200 text-slate-700"}`}>{initials(c.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-[var(--navy)]">{highlight(c.name, nameValue.trim())}</span>
                      <span className="block truncate text-[11px] text-[var(--text-muted)]">{[c.title, c.company].filter(Boolean).join(", ") || "No title or company on file"}</span>
                    </span>
                    {c.email && <span className="hidden shrink-0 text-[11px] text-[var(--text-muted)] sm:block">{c.email}</span>}
                  </div>
                ))}
                {!lookupBusy && nameValue.trim().length >= 2 && (
                  <p className="border-t border-[var(--border-subtle)] bg-slate-50 px-3 py-1.5 text-[11px] text-[var(--text-secondary)]">
                    Not in Contacts? Keep typing and register &ldquo;{nameValue.trim()}&rdquo; as a new guest.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (f.kind === "checkbox") {
      return (
        <label key={f.key} className="flex items-center gap-2 text-xs text-[var(--text-secondary)] sm:col-span-2">
          <input type="checkbox" checked={Boolean(answers[f.key])} onChange={(e) => set(f.key, e.target.checked)} />
          {f.label}
        </label>
      );
    }
    if (f.kind === "chips") {
      const cur = Array.isArray(answers[f.key]) ? (answers[f.key] as string[]) : [];
      const fromContact = filled.has(f.key);
      const chipsNeedInput = Boolean(linked) && f.required === true && cur.length === 0;
      return (
        <div key={f.key} className="sm:col-span-2">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <p className="text-[11px] text-[var(--text-secondary)]">{f.label}</p>
            {fromContact && notes[f.key] && <span className="text-[11px] text-emerald-700">{notes[f.key]}</span>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {f.options!.map((o) => {
              const on = cur.includes(o);
              const style = on
                ? (fromContact ? "border-emerald-700 bg-emerald-50 font-semibold text-emerald-800" : "border-[var(--navy)] bg-[var(--navy)] text-white")
                : (chipsNeedInput ? "border-amber-300 bg-amber-50/60 text-[var(--text-secondary)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)]");
              return (
                <button key={o} type="button" aria-pressed={on} onClick={() => toggleChip(f.key, o)} className={`rounded-full border px-2.5 py-1 text-xs ${style}`}>{o}</button>
              );
            })}
          </div>
          {chipsNeedInput && <span className="mt-1 block text-[11px] text-amber-800">Not on the Contact record. Please choose.</span>}
        </div>
      );
    }
    return (
      <label key={f.key} className={`block ${f.kind === "textarea" ? "sm:col-span-2" : ""}`}>
        {label}
        {f.kind === "select" ? (
          <select value={String(answers[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} className={`w-full rounded-md border px-2 py-1.5 text-xs ${tint}`}>
            <option value="">Select…</option>
            {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : f.kind === "textarea" ? (
          <textarea value={String(answers[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} rows={2} className={`w-full rounded-md border px-2 py-1.5 text-xs ${tint}`} />
        ) : (
          <input type={f.key === "email" ? "email" : f.key === "phone" ? "tel" : "text"} value={String(answers[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} className={`w-full rounded-md border px-2 py-1.5 text-xs ${tint}`} />
        )}
        {filled.has(f.key) && notes[f.key] && <span className="mt-1 block text-[11px] text-emerald-700">{notes[f.key]}</span>}
        {needsHint && (
          <span className="mt-1 block text-[11px] text-amber-800">
            {hints[f.key] ? `${hints[f.key]}. Pick the closest range.` : "Not on the Contact record. Please fill in."}
          </span>
        )}
      </label>
    );
  }

  return (
    <div className="rounded-lg border border-[#bcd3fb] bg-[#f6faff] p-4">
      <div className="mb-3 flex items-center gap-2">
        <i className="ti ti-user-plus text-[var(--blue)]" aria-hidden="true" />
        <span className="text-sm font-medium text-[var(--navy)]">Register a guest manually</span>
        <button type="button" onClick={onClose} className="ml-auto text-xs text-[var(--text-muted)] hover:underline">Cancel</button>
      </div>

      {linked && lookupOn && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" role="status">
          <i className="ti ti-circle-check" aria-hidden="true" />
          <span className="min-w-0 flex-1"><b>Linked to Contact: {linked}.</b> {filled.size} field{filled.size === 1 ? "" : "s"} filled from the Contact and its profile. You can edit any of them before registering.</span>
          <button type="button" onClick={unlinkContact} className="shrink-0 rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] hover:bg-emerald-50">Unlink</button>
        </div>
      )}

      <p className="mb-1.5 text-[11px] text-[var(--text-secondary)]">Registering as</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {REGISTRATION_ROLES.map((r) => (
          <button key={r.key} type="button" onClick={() => setRole(r.key)} className={`rounded-full border px-3 py-1 text-xs ${role === r.key ? "border-[var(--blue)] bg-[var(--indigo-soft)] text-[var(--indigo)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)]"}`}>{r.label}</button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {fields.map(renderField)}
      </div>

      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}

      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs disabled:opacity-50">Cancel</button>
        <button type="button" onClick={submit} disabled={busy} className="rounded-md bg-[var(--blue)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{busy ? "Registering…" : "Register guest"}</button>
      </div>
    </div>
  );
}
