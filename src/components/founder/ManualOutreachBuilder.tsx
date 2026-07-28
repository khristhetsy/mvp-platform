"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Marketing-Hub-style manual investor outreach builder for Outreach → Manual.
 * Four tabs (Audience → Compose → Sequence → Review) with a Continue
 * progression; Review is gated until an audience is selected.
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

type Tab = 0 | 1 | 2 | 3;
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

const TABS = ["Create list", "Compose", "Sequence", "Review & send"];
const CREATE_SUBSTEPS = ["1 Source", "2 Select", "3 Name & save"];

const DEFAULT_SUBJECT = "{{first_name}}, a quick intro to {{company}}";
const DEFAULT_BODY =
  "Hi {{first_name}},\n\nBased on your focus, {{company}} may be a fit. Here's our one-pager: {{founder_preview}}\n\nOpen to a quick intro?";
const DEFAULT_SEQUENCE: SeqStep[] = [
  { label: "Initial email — Warm intro", dayOffset: 0 },
  { label: "Follow-up — “Did you get a chance?”", dayOffset: 3 },
  { label: "Final — “Closing the loop”", dayOffset: 7 },
];
const MERGE_FIELDS = ["{{first_name}}", "{{company}}", "{{founder_preview}}", "{{sector}}"];

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative h-[21px] w-[38px] shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-300 ${on ? "bg-indigo-600" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 h-[17px] w-[17px] rounded-full bg-white shadow-sm transition-transform ${on ? "translate-x-[19px]" : "translate-x-0.5"}`} />
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

  // Create-list sub-flow (Source → Select → Name & save) + reusable saved lists.
  const [createSub, setCreateSub] = useState<0 | 1 | 2>(0);
  const [listSource, setListSource] = useState<"contacts" | "file">("contacts");
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
    if (next === 3 && selectedCount === 0) return;
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

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Investor outreach</h2>
          <p className="mt-1 text-sm text-slate-600">
            Build a list, draft the emails, and let iCapOS run the follow-up sequence.
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

      {/* AI kit */}
      <div className="mt-4 rounded-lg border border-indigo-300 bg-indigo-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-900">✦ AI outreach kit</span>
          <input
            placeholder="Tone — warm, concise…"
            className="ml-auto w-48 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
          />
          <button type="button" className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500">
            Draft emails
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Claude drafts your subject, body, and the full follow-up sequence from your company profile. Everything stays
          editable.
        </p>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 border-b border-slate-200">
        {TABS.map((label, i) => {
          const locked = i === 3 && selectedCount === 0;
          return (
            <button
              key={label}
              type="button"
              onClick={() => goto(i as Tab)}
              disabled={locked}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                tab === i
                  ? "border-indigo-600 text-indigo-600"
                  : locked
                    ? "cursor-not-allowed border-transparent text-slate-300"
                    : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 min-h-[200px]">
        {/* Create list — Source → Select → Name & save */}
        {tab === 0 ? (
          <div>
            <div className="mb-3 flex gap-4 text-xs">
              {CREATE_SUBSTEPS.map((label, si) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setCreateSub(si as 0 | 1 | 2)}
                  className={createSub === si ? "font-medium text-indigo-600" : "text-slate-400 hover:text-slate-600"}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mb-4 flex gap-2 rounded-r-lg border border-l-[3px] border-slate-200 border-l-indigo-500 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
              <span aria-hidden="true">ⓘ</span>
              <span>
                Manual outreach is for your own investors only. Platform-matched investors are handled automatically
                under <b>Automated</b>.
              </span>
            </div>

            {/* Sub-step 1 · Source */}
            {createSub === 0 ? (
              <div>
                {savedLists.length > 0 ? (
                  <div className="mb-4">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Load a saved list</label>
                    <select
                      value={activeListId ?? ""}
                      onChange={(e) => {
                        const l = savedLists.find((x) => x.id === e.target.value);
                        if (l) loadSavedList(l);
                        else setActiveListId(null);
                      }}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">— New list —</option>
                      {savedLists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.contactIds.length})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <p className="mb-2 text-sm text-slate-700">Where should this list come from?</p>
                <div className="flex flex-wrap gap-2">
                  {(["contacts", "file"] as const).map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setListSource(src)}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                        listSource === src
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {src === "contacts" ? "My contacts" : "File upload"}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {listSource === "contacts"
                    ? "Investors already in your CRM — people you've added or who became your investors."
                    : "Import a CSV; rows are added to your contacts. Columns: investor_name, firm_name, email."}
                </p>
              </div>
            ) : null}

            {/* Sub-step 2 · Select */}
            {createSub === 1 ? (
              <div>
                {listSource === "file" ? (
                  <div className="mb-4">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Paste CSV</label>
                    <textarea
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                      rows={4}
                      placeholder="investor_name,firm_name,email&#10;Ada Lovelace,Analytical Ventures,ada@av.com"
                      className="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => void importCsv()}
                      disabled={importing || !csvText.trim()}
                      className="mt-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {importing ? "Importing…" : "Import CSV"}
                    </button>
                  </div>
                ) : (
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="block text-xs font-medium text-slate-600">
                      Your investors <span className="text-slate-400">— tap to select</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setAddOpen((v) => !v)}
                      className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {addOpen ? "Close" : "+ Add investor"}
                    </button>
                  </div>
                )}

                {listSource === "contacts" && addOpen ? (
                  <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <input
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      placeholder="Investor name"
                      className="min-w-[120px] flex-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
                    />
                    <input
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      placeholder="Email (optional)"
                      className="min-w-[140px] flex-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void addContact()}
                      disabled={adding || !addName.trim()}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {adding ? "Adding…" : "Add"}
                    </button>
                  </div>
                ) : null}

                {contactList.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    No investors yet. Add one above or import a CSV, then select who enters the sequence.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {contactList.map((c) => {
                      const on = selected.has(c.id);
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => toggleContact(c.id)}
                            className="flex w-full items-center gap-3 py-2 text-left"
                          >
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${on ? "bg-indigo-600 text-[11px] text-white" : "border-[1.5px] border-slate-300"}`}
                            >
                              {on ? "✓" : ""}
                            </span>
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-medium text-indigo-700">
                              {c.name.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-slate-900">{c.name}</span>
                              <span className="block truncate text-xs text-slate-500">
                                {c.detail ?? c.email ?? "No email on file"}
                              </span>
                            </span>
                            {!c.email ? <span className="text-[10px] text-amber-600">No email</span> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="mt-3 text-xs text-slate-500">
                  <b className="text-slate-800">{selectedCount} selected</b> · they will enter the sequence.
                </p>
              </div>
            ) : null}

            {/* Sub-step 3 · Name & save */}
            {createSub === 2 ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">List name</label>
                <input
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="e.g. Warm angels — Q3"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
                <div className="mt-3 flex justify-between border-t border-slate-100 py-2 text-sm">
                  <span className="text-slate-500">Investors</span>
                  <span className="font-medium text-slate-800">{selectedCount} selected</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-2 text-sm">
                  <span className="text-slate-500">Source</span>
                  <span className="font-medium text-slate-800">
                    {listSource === "contacts" ? "My contacts" : "File upload"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void saveList()}
                  disabled={savingList || !listName.trim()}
                  className="mt-3 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {savingList ? "Saving…" : activeListId ? "Update list" : "Save list"}
                </button>
                <p className="mt-2 text-xs text-slate-400">
                  Saved lists are reusable — load this list for a future campaign from the Source step.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Compose */}
        {tab === 1 ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Subject</label>
              <input
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  markDirty();
                }}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Body</label>
              <textarea
                value={emailBody}
                rows={6}
                onChange={(e) => {
                  setEmailBody(e.target.value);
                  markDirty();
                }}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {MERGE_FIELDS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setEmailBody((b) => `${b}${f}`);
                      markDirty();
                    }}
                    className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700 hover:bg-indigo-100"
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* Sequence */}
        {tab === 2 ? (
          <div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <div>
                <p className="text-sm font-medium text-slate-900">Automatic follow-ups</p>
                <p className="text-xs text-slate-500">Send the steps below on schedule until they reply.</p>
              </div>
              <Switch on={autoFollowUps} onClick={() => { setAutoFollowUps((v) => !v); markDirty(); }} label="Automatic follow-ups" />
            </div>
            <ul className="divide-y divide-slate-100">
              {activeSteps.map((s, i) => (
                <li key={s.label} className="flex items-center gap-3 py-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] text-white">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-slate-900">{s.label}</span>
                  <span className="shrink-0 text-xs text-slate-500">Day {s.dayOffset}</span>
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

        {/* Review */}
        {tab === 3 ? (
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
                <dd className="font-medium text-slate-800">
                  {activeSteps.map((s) => `Day ${s.dayOffset}`).join(" · ")}
                </dd>
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
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${stage.cls}`}>
                          {stage.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Footer: Continue / Back progression + messages */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => {
            if (tab === 0 && createSub > 0) setCreateSub((s) => (s - 1) as 0 | 1 | 2);
            else if (tab > 0) setTab((t) => (t - 1) as Tab);
          }}
          className={`rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 ${tab === 0 && createSub === 0 ? "invisible" : ""}`}
        >
          ← Back
        </button>
        <div className="ml-auto flex items-center gap-3">
          {message ? <span className="text-xs text-slate-500">{message}</span> : null}
          {tab === 0 && createSub >= 1 && selectedCount === 0 ? (
            <span className="text-xs text-slate-400">Select at least one investor to continue</span>
          ) : null}
          {tab < 3 ? (
            <button
              type="button"
              onClick={() => {
                if (tab === 0 && createSub < 2) setCreateSub((s) => (s + 1) as 0 | 1 | 2);
                else goto((tab + 1) as Tab);
              }}
              disabled={tab === 0 && createSub >= 1 && selectedCount === 0}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {tab === 0
                ? createSub === 0
                  ? "Continue → Select"
                  : createSub === 1
                    ? "Continue → Name & save"
                    : "Continue → Compose"
                : tab === 1
                  ? "Continue → Sequence"
                  : "Continue → Review"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
