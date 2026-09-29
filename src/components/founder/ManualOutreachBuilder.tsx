"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Manual investor outreach workspace for Outreach → Manual, laid out in three
 * panes: recipients (left), compose / sequence / review (middle) and a live
 * preview of the exact email the previewed investor receives (right). Review is
 * gated until at least one recipient is selected.
 *
 * Persistence goes through /api/founder/outreach/manual. "Start sequence" marks
 * the campaign queued — live email dispatch reuses the platform send path and is
 * gated the same way as automated outreach (INVESTOR_OUTREACH_LIVE); this builder
 * does not itself email anyone.
 */

export type OutreachAudienceContact = {
  id: string;
  name: string;
  email: string | null;
  detail?: string | null;
};

type Tab = 0 | 1 | 2;
type SeqStep = { label: string; dayOffset: number };
type RecipientStatus = {
  name: string | null;
  email: string;
  status: string;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  repliedAt: string | null;
};

function recipientStage(r: RecipientStatus): { label: string; cls: string; at: string | null } {
  if (r.repliedAt) return { label: "Replied", cls: "bg-teal-50 text-teal-700", at: r.repliedAt };
  if (r.clickedAt) return { label: "Clicked", cls: "bg-teal-50 text-teal-700", at: r.clickedAt };
  if (r.openedAt) return { label: "Opened", cls: "bg-emerald-50 text-emerald-700", at: r.openedAt };
  if (r.status === "skipped") return { label: "Skipped", cls: "bg-slate-100 text-slate-500", at: null };
  if (r.status === "stopped") return { label: "Stopped", cls: "bg-slate-100 text-slate-500", at: r.sentAt };
  if (r.sentAt) return { label: "Sent", cls: "bg-indigo-50 text-indigo-700", at: r.sentAt };
  return { label: "Queued", cls: "bg-amber-50 text-amber-700", at: null };
}

function shortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const TABS = ["Compose", "Sequence", "Review and send"];

const DEFAULT_SUBJECT = "{{first_name}}, a quick intro to {{company}}";
const DEFAULT_BODY =
  "Hi {{first_name}},\n\nBased on your focus, {{company}} may be a fit. Here's our one-pager: {{founder_preview}}\n\nOpen to a quick intro?";
const DEFAULT_SEQUENCE: SeqStep[] = [
  { label: "Initial email — Warm intro", dayOffset: 0 },
  { label: "Follow-up — “Did you get a chance?”", dayOffset: 3 },
  { label: "Final — “Closing the loop”", dayOffset: 7 },
];
const MERGE_FIELDS = ["{{first_name}}", "{{company}}", "{{founder_preview}}", "{{sector}}"];
const TONE_PRESETS = ["Warm", "Direct", "Concise", "Formal", "Storytelling"] as const;

/** Fill the recipient-specific merge field we know for the live preview; leave the
 *  rest as tokens (they resolve per recipient at send time). */
function resolvePreview(text: string, firstName: string | null): string {
  return firstName ? text.replaceAll("{{first_name}}", firstName) : text;
}

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className="outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
      style={{
        position: "relative", flexShrink: 0,
        width: 40, height: 22, borderRadius: 9999,
        border: "none", cursor: "pointer", padding: 0,
        transition: "background-color 0.15s ease",
        background: on ? "#4f46e5" : "#cbd5e1",
      }}
    >
      <span
        style={{
          position: "absolute", top: 2, left: 2,
          width: 18, height: 18, borderRadius: "50%",
          background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
          transition: "transform 0.15s ease",
          transform: on ? "translateX(18px)" : "translateX(0)",
        }}
      />
    </button>
  );
}

export function ManualOutreachBuilder({
  contacts,
  initial,
}: {
  contacts: OutreachAudienceContact[];
  initial?: {
    status?: "draft" | "queued";
    emailSubject?: string;
    emailBody?: string;
    sequence?: SeqStep[];
    recipientIds?: string[];
    stopOnReply?: boolean;
  } | null;
}) {
  const [tab, setTab] = useState<Tab>(0);
  const [selected, setSelected] = useState<Set<string>>(new Set(initial?.recipientIds ?? []));
  const [subject, setSubject] = useState(initial?.emailSubject || DEFAULT_SUBJECT);
  const [emailBody, setEmailBody] = useState(initial?.emailBody || DEFAULT_BODY);
  const [autoFollowUps, setAutoFollowUps] = useState(true);
  const [stopOnReply, setStopOnReply] = useState(initial?.stopOnReply ?? true);
  const [sequence] = useState<SeqStep[]>(initial?.sequence?.length ? initial.sequence : DEFAULT_SEQUENCE);
  const [tone, setTone] = useState("Warm");
  const [customTone, setCustomTone] = useState("");
  const [previewStep, setPreviewStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"draft" | "queued">(initial?.status ?? "draft");
  const [message, setMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [recipients, setRecipients] = useState<RecipientStatus[]>([]);
  const [contactList, setContactList] = useState<OutreachAudienceContact[]>(contacts);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [testing, setTesting] = useState(false);
  const [drafting, setDrafting] = useState(false);

  // Recipients pane: search, add / import panels, previewed investor + reusable saved lists.
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [listName, setListName] = useState("");
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [savedLists, setSavedLists] = useState<{ id: string; name: string; contactIds: string[] }[]>([]);
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const [savingList, setSavingList] = useState(false);

  async function loadLists() {
    try {
      const res = await fetch("/api/founder/outreach/lists");
      if (!res.ok) return;
      const data = (await res.json()) as { lists?: { id: string; name: string; contactIds: string[] }[] };
      if (Array.isArray(data.lists)) setSavedLists(data.lists);
    } catch {
      /* ignore */
    }
  }

  function loadSavedList(list: { id: string; name: string; contactIds: string[] }) {
    setSelected(new Set(list.contactIds));
    setActiveListId(list.id);
    setListName(list.name);
    setDirty(true);
    setMessage(null);
  }

  async function saveList() {
    if (!listName.trim()) return;
    setSavingList(true);
    setMessage(null);
    try {
      const res = await fetch("/api/founder/outreach/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeListId, name: listName.trim(), contactIds: [...selected] }),
      });
      const data = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (res.ok) {
        if (data?.id) setActiveListId(data.id);
        await loadLists();
        setMessage("List saved.");
      } else {
        setMessage(data?.error ?? "Couldn't save the list.");
      }
    } finally {
      setSavingList(false);
    }
  }

  async function importCsv() {
    if (!csvText.trim()) return;
    setImporting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/founder/investor-contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: csvText, confirm: true }),
      });
      if (res.ok) {
        setCsvText("");
        await refreshContacts();
        setMessage("Import complete — review your list below.");
      } else {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        setMessage(d?.error ?? "Import failed. Check the CSV columns and try again.");
      }
    } finally {
      setImporting(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/founder/outreach/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body: emailBody }),
      });
      const data = (await res.json().catch(() => null)) as { sentTo?: string; error?: string } | null;
      setMessage(res.ok ? `Test sent to ${data?.sentTo ?? "your inbox"}.` : data?.error ?? "Couldn't send test.");
    } catch {
      setMessage("Network error sending test.");
    } finally {
      setTesting(false);
    }
  }

  async function draftEmails() {
    if (drafting) return;
    const contactId = [...selected][0] ?? contactList[0]?.id;
    if (!contactId) {
      setMessage("Select at least one recipient first.");
      return;
    }
    setDrafting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/founder/outreach/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "intro", contactId, tone: tone === "Custom" ? customTone.trim() : tone }),
      });
      const data = (await res.json().catch(() => null)) as { draft?: { subject?: string; body?: string }; error?: string } | null;
      if (!res.ok) {
        setMessage(data?.error ?? "Couldn't draft emails.");
        return;
      }
      if (data?.draft?.subject) setSubject(data.draft.subject);
      if (data?.draft?.body) setEmailBody(data.draft.body);
      setDirty(true);
      setMessage("Draft ready — edit anything below.");
    } catch {
      setMessage("Network error drafting emails.");
    } finally {
      setDrafting(false);
    }
  }

  async function refreshContacts() {
    try {
      const res = await fetch("/api/founder/investor-contacts");
      if (!res.ok) return;
      const data = (await res.json()) as {
        contacts?: Array<{ id: string; investor_name: string; email: string | null; firm_name: string | null; investor_type: string | null }>;
      };
      if (Array.isArray(data.contacts)) {
        setContactList(
          data.contacts.map((c) => ({
            id: c.id,
            name: c.investor_name,
            email: c.email,
            detail: [c.firm_name, c.investor_type].filter(Boolean).join(" · ") || c.email,
          })),
        );
      }
    } catch {
      /* ignore */
    }
  }

  async function addContact() {
    if (!addName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/founder/investor-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investor_name: addName.trim(), email: addEmail.trim() || "" }),
      });
      if (res.ok) {
        setAddName("");
        setAddEmail("");
        setAddOpen(false);
        await refreshContacts();
      } else {
        setMessage("Couldn't add that investor. Check the email and try again.");
      }
    } finally {
      setAdding(false);
    }
  }

  // Load saved contact lists once on mount.
  useEffect(() => {
    let active = true;
    void fetch("/api/founder/outreach/lists")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { lists?: { id: string; name: string; contactIds: string[] }[] } | null) => {
        if (active && Array.isArray(data?.lists)) setSavedLists(data.lists);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Load any previously-saved campaign + recipient statuses (unless a snapshot
  // was passed in).
  useEffect(() => {
    if (initial) return;
    let active = true;
    void fetch("/api/founder/outreach/manual")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (data: {
          campaign?: { status?: string; emailSubject?: string; emailBody?: string; sequence?: SeqStep[]; recipientIds?: string[]; stopOnReply?: boolean } | null;
          recipients?: RecipientStatus[];
        } | null) => {
          if (!active) return;
          const c = data?.campaign;
          if (c) {
            if (c.emailSubject) setSubject(c.emailSubject);
            if (c.emailBody) setEmailBody(c.emailBody);
            if (Array.isArray(c.recipientIds)) setSelected(new Set(c.recipientIds));
            if (typeof c.stopOnReply === "boolean") setStopOnReply(c.stopOnReply);
            if (c.status === "queued") setStatus("queued");
          }
          if (Array.isArray(data?.recipients)) setRecipients(data.recipients);
        },
      )
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCount = selected.size;
  const activeSteps = useMemo(() => (autoFollowUps ? sequence : sequence.slice(0, 1)), [autoFollowUps, sequence]);

  function markDirty() {
    setDirty(true);
    setMessage(null);
  }
  function toggleContact(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    markDirty();
  }
  function goto(next: Tab) {
    if (next === 2 && selectedCount === 0) return;
    setTab(next);
  }

  async function persist(action: "save" | "start") {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/founder/outreach/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          subject,
          body: emailBody,
          sequence: activeSteps,
          recipientIds: [...selected],
          stopOnReply,
        }),
      });
      const data = (await res.json().catch(() => null)) as { status?: string; error?: string } | null;
      if (!res.ok) {
        setMessage(data?.error ?? "Something went wrong.");
        return;
      }
      setDirty(false);
      if (action === "start") {
        setStatus("queued");
        setMessage("Sequence started — investors will be contacted per the send schedule.");
      } else {
        setMessage("Saved.");
      }
    } catch {
      setMessage("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const q = search.trim().toLowerCase();
  const filteredContacts = q
    ? contactList.filter((c) => `${c.name} ${c.detail ?? ""} ${c.email ?? ""}`.toLowerCase().includes(q))
    : contactList;
  const previewRecipient =
    contactList.find((c) => c.id === previewId) ??
    contactList.find((c) => selected.has(c.id)) ??
    contactList[0] ??
    null;
  const previewFirstName = previewRecipient?.name ? previewRecipient.name.split(/\s+/)[0] : null;
  const pStep = Math.min(previewStep, Math.max(0, activeSteps.length - 1));
  const pStepData = activeSteps[pStep];
  const allFilteredSelected = filteredContacts.length > 0 && filteredContacts.every((c) => selected.has(c.id));

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filteredContacts.forEach((c) => next.delete(c.id));
      else filteredContacts.forEach((c) => next.add(c.id));
      return next;
    });
    markDirty();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Investor outreach</h2>
          <p className="mt-1 text-sm text-slate-600">
            Pick investors on the left, write in the middle, and see exactly what each one receives on the right.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status === "queued" ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Running</span>
          ) : dirty ? (
            <span className="text-xs text-amber-600">Unsaved changes</span>
          ) : null}
          <button
            type="button"
            onClick={() => void persist("save")}
            disabled={saving}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save campaign"}
          </button>
        </div>
      </div>

      {message ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600" role="status">{message}</p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_300px]">
        {/* ---------- LEFT · Recipients ---------- */}
        <div className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Recipients</p>
            <span className="text-xs text-slate-500">{selectedCount} of {contactList.length} selected</span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            Your own investors only. Platform matches are handled under Automated.
          </p>

          {savedLists.length > 0 ? (
            <select
              value={activeListId ?? ""}
              onChange={(e) => {
                const l = savedLists.find((x) => x.id === e.target.value);
                if (l) loadSavedList(l);
                else setActiveListId(null);
              }}
              className="mt-3 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
              aria-label="Load a saved list"
            >
              <option value="">Load a saved list…</option>
              {savedLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.contactIds.length})
                </option>
              ))}
            </select>
          ) : null}

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, firm, email"
            className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
          />

          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => { setAddOpen((v) => !v); setImportOpen(false); }}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              {addOpen ? "Close" : "+ Add investor"}
            </button>
            <button
              type="button"
              onClick={() => { setImportOpen((v) => !v); setAddOpen(false); }}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              {importOpen ? "Close" : "Import CSV"}
            </button>
            {filteredContacts.length > 0 ? (
              <button
                type="button"
                onClick={toggleAllFiltered}
                className="ml-auto rounded-md px-2 py-1 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50"
              >
                {allFilteredSelected ? "Clear" : "Select all"}
              </button>
            ) : null}
          </div>

          {addOpen ? (
            <div className="mt-2 space-y-1.5 rounded-lg border border-slate-200 bg-white p-2">
              <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Investor name" className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs" />
              <input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="Email (optional)" className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs" />
              <button type="button" onClick={() => void addContact()} disabled={adding || !addName.trim()} className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                {adding ? "Adding…" : "Add"}
              </button>
            </div>
          ) : null}

          {importOpen ? (
            <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={4}
                placeholder="investor_name,firm_name,email&#10;Ada Lovelace,Analytical Ventures,ada@av.com"
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 font-mono text-[11px]"
              />
              <button type="button" onClick={() => void importCsv()} disabled={importing || !csvText.trim()} className="mt-1.5 w-full rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                {importing ? "Importing…" : "Import CSV"}
              </button>
            </div>
          ) : null}

          <ul className="mt-2 max-h-[420px] flex-1 space-y-1 overflow-y-auto">
            {filteredContacts.length === 0 ? (
              <li className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-5 text-center text-xs text-slate-500">
                {contactList.length === 0 ? "No investors yet. Add one or import a CSV." : "No one matches that search."}
              </li>
            ) : (
              filteredContacts.map((c) => {
                const on = selected.has(c.id);
                const previewing = previewRecipient?.id === c.id;
                return (
                  <li
                    key={c.id}
                    className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${previewing ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white"}`}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      aria-label={`Select ${c.name}`}
                      onClick={() => toggleContact(c.id)}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${on ? "bg-indigo-600 text-[11px] text-white" : "border-[1.5px] border-slate-300"}`}
                    >
                      {on ? <i className="ti ti-check" aria-hidden="true" /> : null}
                    </button>
                    <button type="button" onClick={() => setPreviewId(c.id)} className="min-w-0 flex-1 text-left" title="Preview this investor's email">
                      <span className="block truncate text-xs font-medium text-slate-900">{c.name}</span>
                      <span className="block truncate text-[11px] text-slate-500">{c.detail ?? c.email ?? "No email on file"}</span>
                    </button>
                    {!c.email ? <span className="shrink-0 text-[10px] text-amber-600">No email</span> : null}
                  </li>
                );
              })
            )}
          </ul>

          <div className="mt-3 border-t border-slate-200 pt-2">
            <div className="flex gap-1.5">
              <input
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="Name this list"
                className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={() => void saveList()}
                disabled={savingList || !listName.trim() || selectedCount === 0}
                className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {savingList ? "Saving…" : activeListId ? "Update" : "Save list"}
              </button>
            </div>
          </div>
        </div>

        {/* ---------- MIDDLE · Compose / Sequence / Review ---------- */}
        <div className="min-w-0 rounded-xl border border-slate-200 p-4">
          {/* AI kit */}
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-900"><i className="ti ti-sparkles" aria-hidden="true" /> AI outreach kit</span>
              <button type="button" onClick={() => void draftEmails()} disabled={drafting} className="ml-auto rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                {drafting ? "Drafting…" : "Draft emails"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 text-xs text-slate-500">Tone:</span>
              {TONE_PRESETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${tone === t ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300"}`}
                >
                  {t}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setTone("Custom")}
                className={`rounded-full border border-dashed px-2.5 py-1 text-xs font-medium transition-colors ${tone === "Custom" ? "border-indigo-600 text-indigo-700" : "border-slate-300 text-slate-500 hover:border-indigo-300"}`}
              >
                Custom…
              </button>
              {tone === "Custom" && (
                <input
                  value={customTone}
                  onChange={(e) => setCustomTone(e.target.value)}
                  placeholder="e.g. punchy, founder-to-founder"
                  className="w-48 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                />
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-3 flex gap-1 border-b border-slate-200">
            {TABS.map((label, i) => {
              const locked = i === 2 && selectedCount === 0;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => goto(i as Tab)}
                  disabled={locked}
                  title={locked ? "Select at least one recipient first" : undefined}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                    tab === i
                      ? "border-indigo-600 text-indigo-600"
                      : locked
                        ? "cursor-not-allowed border-transparent text-slate-300"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {i + 1}. {label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 min-h-[260px]">
            {tab === 0 ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Subject</label>
                  <input
                    value={subject}
                    onChange={(e) => { setSubject(e.target.value); markDirty(); }}
                    onFocus={() => setPreviewStep(0)}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Body</label>
                  <textarea
                    value={emailBody}
                    rows={9}
                    onChange={(e) => { setEmailBody(e.target.value); markDirty(); }}
                    onFocus={() => setPreviewStep(0)}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {MERGE_FIELDS.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => { setEmailBody((b) => `${b}${f}`); markDirty(); }}
                        className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700 hover:bg-indigo-100"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 1 ? (
              <div>
                <div className="flex items-center justify-between gap-4 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Automatic follow-ups</p>
                    <p className="text-xs text-slate-500">Click a step to preview it on the right.</p>
                  </div>
                  <Switch on={autoFollowUps} onClick={() => { setAutoFollowUps((v) => !v); markDirty(); }} label="Automatic follow-ups" />
                </div>
                <ul className="space-y-1">
                  {activeSteps.map((s, i) => (
                    <li key={s.label}>
                      <button
                        type="button"
                        onClick={() => setPreviewStep(i)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${i === pStep ? "border-indigo-300 bg-indigo-50" : "border-transparent hover:bg-slate-50"}`}
                      >
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${i === pStep ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>{i + 1}</span>
                        <span className="min-w-0 flex-1 text-sm font-medium text-slate-900">{s.label}</span>
                        <span className="shrink-0 text-xs text-slate-500">Day {s.dayOffset}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between gap-4 border-t border-slate-100 pt-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Stop when the investor replies</p>
                    <p className="text-xs text-slate-500">No more auto-sends once they respond.</p>
                  </div>
                  <Switch on={stopOnReply} onClick={() => { setStopOnReply((v) => !v); markDirty(); }} label="Stop on reply" />
                </div>
              </div>
            ) : null}

            {tab === 2 ? (
              <div>
                <dl className="text-sm">
                  <div className="flex justify-between border-b border-slate-100 py-2">
                    <dt className="text-slate-500">Recipients</dt>
                    <dd className="font-medium text-slate-800">{selectedCount} investors</dd>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-2">
                    <dt className="text-slate-500">Sequence</dt>
                    <dd className="font-medium text-slate-800">
                      {activeSteps.length} step{activeSteps.length === 1 ? "" : "s"}
                      {stopOnReply ? " · stops on reply" : ""}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2">
                    <dt className="text-slate-500">Schedule</dt>
                    <dd className="font-medium text-slate-800">{activeSteps.map((s) => `Day ${s.dayOffset}`).join(" · ")}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
                  <span aria-hidden="true">ⓘ</span>
                  <span>
                    Each email includes an unsubscribe link and honors the platform suppression list. This shares your Founder
                    Preview and is not an offer or solicitation of securities.
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void persist("start")}
                    disabled={saving || selectedCount === 0}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {saving ? "Starting…" : status === "queued" ? "Update sequence" : "Start sequence"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendTest()}
                    disabled={testing || !emailBody.trim()}
                    className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {testing ? "Sending…" : "Send test to me"}
                  </button>
                </div>

                {recipients.length > 0 ? (
                  <div className="mt-6">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-slate-900">Recipient activity</h3>
                      <span className="text-xs text-slate-400">{recipients.length} enrolled</span>
                    </div>
                    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                      {recipients.map((r) => {
                        const stage = recipientStage(r);
                        return (
                          <li key={r.email} className="flex items-center gap-3 px-3 py-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-medium text-indigo-700">
                              {(r.name ?? r.email).slice(0, 2).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-slate-800">{r.name ?? r.email}</span>
                              {r.name ? <span className="block truncate text-xs text-slate-400">{r.email}</span> : null}
                            </span>
                            {stage.at ? <span className="shrink-0 text-xs text-slate-400">{shortDate(stage.at)}</span> : null}
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${stage.cls}`}>{stage.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Footer progression */}
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => { if (tab > 0) setTab((t) => (t - 1) as Tab); }}
              className={`rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 ${tab === 0 ? "invisible" : ""}`}
            >
              ← Back
            </button>
            {tab < 2 ? (
              <div className="ml-auto flex items-center gap-3">
                {tab === 1 && selectedCount === 0 ? (
                  <span className="text-xs text-slate-400">Select at least one recipient to review</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => goto((tab + 1) as Tab)}
                  disabled={tab === 1 && selectedCount === 0}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {tab === 0 ? "Continue → Sequence" : "Continue → Review"}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* ---------- RIGHT · Live preview ---------- */}
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 lg:col-span-2 xl:sticky xl:top-16 xl:col-span-1 xl:self-start">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
            <span className="text-xs font-medium text-slate-500">
              Live preview · Step {pStep + 1}{pStepData ? ` · Day ${pStepData.dayOffset}` : ""}
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              {tone === "Custom" ? (customTone.trim() || "Custom") : tone} tone
            </span>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">To</p>
            <p className="mb-2.5 text-[13px] text-slate-700">
              {previewRecipient ? (previewRecipient.name || previewRecipient.email || "Recipient") : "No recipient yet"}
              {previewRecipient?.detail ? <span className="text-slate-400"> · {previewRecipient.detail}</span> : null}
            </p>
            {pStep === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">Subject</p>
                <p className="mb-2.5 text-[13px] font-medium text-slate-900">{resolvePreview(subject, previewFirstName)}</p>
                <div className="whitespace-pre-wrap border-t border-slate-100 pt-2.5 text-[13px] leading-6 text-slate-700">
                  {resolvePreview(emailBody, previewFirstName)}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3 text-[13px] text-slate-600">
                <p className="font-medium text-slate-800">{pStepData?.label}</p>
                <p className="mt-1 text-slate-500">
                  A short follow-up on the first email, sent on day {pStepData?.dayOffset} if they haven&apos;t replied.
                </p>
              </div>
            )}
            <p className="mt-3 text-[10.5px] leading-snug text-slate-400">
              Click any name on the left to preview their copy. Merge fields fill per recipient at send time.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
