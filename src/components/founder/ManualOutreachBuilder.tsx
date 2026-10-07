"use client";

/**
 * Outreach → Manual, laid out like the Sales hub Contacts list: New and gear on
 * the left, the Odoo search bar (filters, group by, favorites), row checkboxes,
 * and a selection bar with Send email and Actions. Send email opens the composer
 * (OutreachComposer) with the selected investors; the gear imports contacts
 * (My contacts picker, drag and drop file import, LinkedIn) and loads saved lists.
 *
 * Persistence goes through /api/founder/outreach/manual. "Send" starts the
 * campaign: the selected contacts are enrolled and the cron send pass emails
 * each due step (live only when INVESTOR_OUTREACH_LIVE is on), with the chosen
 * attachments. The selection is the campaign audience, as before.
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { FounderToolbar, applySearch, groupRows } from "@/components/founder/FounderToolbar";
import { EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";
import { useDismiss } from "@/lib/ui/use-dismiss";
import { contactSourceLabel } from "@/lib/founder-crm/contact-labels";
import { DEFAULT_ATTACHMENTS, normalizeAttachments, type ManualAttachments } from "@/lib/outreach/manual-attachments";
import { ContactImportDialog, downloadTemplateCsv } from "@/components/founder/outreach/ContactImportDialog";
import { MyContactsPicker } from "@/components/founder/outreach/MyContactsPicker";
import { OutreachComposer, type SeqStep } from "@/components/founder/outreach/OutreachComposer";
import type { AttachmentOptions, OutreachContact, RecipientStatus } from "@/components/founder/outreach/types";

export type OutreachAudienceContact = {
  id: string;
  name: string;
  email: string | null;
  detail?: string | null;
};

const DEFAULT_SUBJECT = "{{first_name}}, a quick intro to {{company}}";
const DEFAULT_BODY =
  "Hi {{first_name}},\n\nBased on your focus in {{sector}}, {{company}} may be a fit. Our one pager is attached.\n\nOpen to a quick intro?";
const DEFAULT_SEQUENCE: SeqStep[] = [
  { label: "Initial email", dayOffset: 0 },
  { label: "Follow up", dayOffset: 3 },
  { label: "Closing the loop", dayOffset: 7 },
];
const SOURCE_ORDER = ["Imported", "Added by you", "Introduced"];
const SOURCE_STYLE: Record<string, string> = {
  Introduced: "bg-emerald-50 text-emerald-700",
  Imported: "bg-indigo-50 text-indigo-700",
  "Added by you": "bg-slate-100 text-slate-600",
};

function stageOf(r: RecipientStatus): { label: string; cls: string } {
  if (r.repliedAt) return { label: "Replied", cls: "bg-teal-50 text-teal-700" };
  if (r.clickedAt) return { label: "Clicked", cls: "bg-teal-50 text-teal-700" };
  if (r.openedAt) return { label: "Opened", cls: "bg-emerald-50 text-emerald-700" };
  if (r.status === "skipped") return { label: "Skipped", cls: "bg-slate-100 text-slate-500" };
  if (r.status === "stopped") return { label: "Stopped", cls: "bg-slate-100 text-slate-500" };
  if (r.sentAt) return { label: "Sent", cls: "bg-blue-50 text-[#185FA5]" };
  return { label: "Queued", cls: "bg-amber-50 text-amber-700" };
}

function csvCell(v: string | null | undefined): string {
  const s = v ?? "";
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function downloadCsv(rows: OutreachContact[], name: string) {
  const header = ["name", "firm", "email", "investor_type", "sector", "source"];
  const lines = rows.map((r) => [r.name, r.firm, r.email, r.investorType, r.sectors, r.source].map(csvCell).join(","));
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function fromAudience(c: OutreachAudienceContact): OutreachContact {
  return { id: c.id, name: c.name, email: c.email, firm: null, investorType: null, sectors: null, source: "Added by you", detail: c.detail ?? null };
}

type ApiContact = {
  id: string;
  investor_name: string;
  email: string | null;
  firm_name: string | null;
  investor_type: string | null;
  preferred_sectors: string | null;
  source: string;
  status?: string;
};

async function fetchContacts(): Promise<OutreachContact[] | null> {
  try {
    const res = await fetch("/api/founder/investor-contacts");
    if (!res.ok) return null;
    const data = (await res.json()) as { contacts?: ApiContact[] };
    if (!Array.isArray(data.contacts)) return null;
    return data.contacts.map((c) => ({
      id: c.id,
      name: c.investor_name,
      email: c.email,
      firm: c.firm_name,
      investorType: c.investor_type,
      sectors: c.preferred_sectors,
      source: contactSourceLabel(c.source),
      detail: [c.firm_name, c.investor_type].filter(Boolean).join(" · ") || c.email,
    }));
  } catch {
    return null;
  }
}

async function fetchLists(): Promise<{ id: string; name: string; contactIds: string[] }[] | null> {
  try {
    const res = await fetch("/api/founder/outreach/lists");
    if (!res.ok) return null;
    const data = (await res.json()) as { lists?: { id: string; name: string; contactIds: string[] }[] };
    return Array.isArray(data.lists) ? data.lists : null;
  } catch {
    return null;
  }
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
  // ---- Campaign ----
  const [selected, setSelected] = useState<Set<string>>(new Set(initial?.recipientIds ?? []));
  const [subject, setSubject] = useState(initial?.emailSubject || DEFAULT_SUBJECT);
  const [emailBody, setEmailBody] = useState(initial?.emailBody || DEFAULT_BODY);
  const [sequence] = useState<SeqStep[]>(initial?.sequence?.length ? initial.sequence : DEFAULT_SEQUENCE);
  const [autoFollowUps, setAutoFollowUps] = useState(initial?.sequence ? initial.sequence.length > 1 : true);
  const [stopOnReply, setStopOnReply] = useState(initial?.stopOnReply ?? true);
  const [attachments, setAttachments] = useState<ManualAttachments>({ ...DEFAULT_ATTACHMENTS });
  const [status, setStatus] = useState<"draft" | "queued">(initial?.status ?? "draft");
  const [savedRecipientIds, setSavedRecipientIds] = useState<string[]>(initial?.recipientIds ?? []);
  const [recipients, setRecipients] = useState<RecipientStatus[]>([]);
  const [dirty, setDirty] = useState(false);
  const [tone, setTone] = useState("Warm");
  const [customTone, setCustomTone] = useState("");
  const [options, setOptions] = useState<AttachmentOptions | null>(null);

  // ---- List ----
  const [contactList, setContactList] = useState<OutreachContact[]>(() => contacts.map(fromAudience));
  const [search, setSearch] = useState<SearchState>({ ...EMPTY_SEARCH, groupBy: "source" });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [savedLists, setSavedLists] = useState<{ id: string; name: string; contactIds: string[] }[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);

  // ---- UI ----
  const [panel, setPanel] = useState<"none" | "add" | "saveList">("none");
  const [dialog, setDialog] = useState<"none" | "compose" | "picker" | "import" | "linkedin">("none");
  const [gearOpen, setGearOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [form, setForm] = useState({ name: "", firm: "", email: "", type: "" });
  const [listName, setListName] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [composeMessage, setComposeMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const closeGear = useCallback(() => setGearOpen(false), []);
  const closeActions = useCallback(() => setActionsOpen(false), []);
  const gearRef = useDismiss(gearOpen, closeGear);
  const actionsRef = useDismiss(actionsOpen, closeActions);

  const refreshContacts = useCallback(async () => {
    const rows = await fetchContacts();
    if (rows) setContactList(rows);
  }, []);

  const loadLists = useCallback(async () => {
    const lists = await fetchLists();
    if (lists) setSavedLists(lists);
  }, []);

  // Full contact records (firm, type, source) for the list, saved lists and the
  // attachment options, once on mount.
  useEffect(() => {
    let active = true;
    void fetchContacts().then((rows) => {
      if (active && rows) setContactList(rows);
    });
    void fetchLists().then((lists) => {
      if (active && lists) setSavedLists(lists);
    });
    void fetch("/api/founder/outreach/attachments")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AttachmentOptions | null) => {
        if (active && d) setOptions(d);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // The saved campaign and recipient statuses (unless a snapshot was passed in).
  useEffect(() => {
    if (initial) return;
    let active = true;
    void fetch("/api/founder/outreach/manual")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (data: {
          campaign?: {
            status?: string;
            emailSubject?: string;
            emailBody?: string;
            sequence?: SeqStep[];
            recipientIds?: string[];
            stopOnReply?: boolean;
            attachments?: unknown;
          } | null;
          recipients?: RecipientStatus[];
        } | null) => {
          if (!active) return;
          const c = data?.campaign;
          if (c) {
            if (c.emailSubject) setSubject(c.emailSubject);
            if (c.emailBody) setEmailBody(c.emailBody);
            if (Array.isArray(c.recipientIds)) {
              setSelected(new Set(c.recipientIds));
              setSavedRecipientIds(c.recipientIds);
            }
            if (Array.isArray(c.sequence) && c.sequence.length > 0) setAutoFollowUps(c.sequence.length > 1);
            if (typeof c.stopOnReply === "boolean") setStopOnReply(c.stopOnReply);
            setAttachments(normalizeAttachments(c.attachments));
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

  // ---- Derived ----
  const statusByEmail = useMemo(() => {
    const m = new Map<string, RecipientStatus>();
    for (const r of recipients) m.set(r.email.trim().toLowerCase(), r);
    return m;
  }, [recipients]);

  const outreachLabel = useCallback(
    (c: OutreachContact) => {
      const r = c.email ? statusByEmail.get(c.email.trim().toLowerCase()) : undefined;
      return r ? stageOf(r).label : "Not contacted";
    },
    [statusByEmail],
  );

  const filtered = applySearch(contactList, search, {
    text: (r) => [r.name, r.firm ?? "", r.email ?? "", r.investorType ?? "", r.sectors ?? ""].join(" "),
    quick: {
      has_email: (r) => !!r.email,
      not_contacted: (r) => outreachLabel(r) === "Not contacted",
      selected: (r) => selected.has(r.id),
      imported: (r) => r.source === "Imported",
      added: (r) => r.source === "Added by you",
    },
    field: {
      source: (r) => r.source,
      type: (r) => r.investorType,
      outreach: (r) => outreachLabel(r),
    },
  });

  const groups = useMemo(() => {
    const g = groupRows(filtered, search.groupBy, "none", {
      source: (r) => r.source,
      type: (r) => r.investorType ?? "",
      outreach: (r) => outreachLabel(r),
    });
    if (search.groupBy === "source") g.sort((a, b) => SOURCE_ORDER.indexOf(a.label) - SOURCE_ORDER.indexOf(b.label));
    return g;
  }, [filtered, search.groupBy, outreachLabel]);

  const selectedRows = contactList.filter((c) => selected.has(c.id));
  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const activeSteps = autoFollowUps ? sequence : sequence.slice(0, 1);

  // Investors in a running sequence who would be stopped by sending now.
  const droppedActive = useMemo(() => {
    if (status !== "queued") return 0;
    const chosen = new Set(selectedRows.map((c) => (c.email ?? "").trim().toLowerCase()).filter(Boolean));
    return recipients.filter((r) => r.status === "active" && !r.repliedAt && !chosen.has(r.email.trim().toLowerCase())).length;
  }, [status, selectedRows, recipients]);

  // ---- Actions ----
  function markDirty() {
    setDirty(true);
    setComposeMessage(null);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    setDirty(true);
  }

  function selectIds(ids: string[], replace = false) {
    setSelected((prev) => {
      const n = replace ? new Set<string>() : new Set(prev);
      ids.forEach((id) => n.add(id));
      return n;
    });
    setDirty(true);
  }

  async function addContact() {
    if (!form.name.trim()) {
      setMessage({ tone: "error", text: "Enter the investor's name." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/founder/investor-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investor_name: form.name.trim(),
          firm_name: form.firm.trim() || undefined,
          email: form.email.trim(),
          investor_type: form.type.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; contact?: { id?: string } } | null;
      if (!res.ok) {
        setMessage({ tone: "error", text: data?.error ?? "Couldn't add that investor. Check the email and try again." });
        return;
      }
      setForm({ name: "", firm: "", email: "", type: "" });
      setPanel("none");
      setMessage({ tone: "ok", text: "Investor added." });
      await refreshContacts();
    } finally {
      setBusy(false);
    }
  }

  async function saveList() {
    if (!listName.trim()) {
      setMessage({ tone: "error", text: "Name the list first." });
      return;
    }
    setBusy(true);
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
        setPanel("none");
        setMessage({ tone: "ok", text: `List "${listName.trim()}" saved.` });
      } else {
        setMessage({ tone: "error", text: data?.error ?? "Couldn't save the list." });
      }
    } finally {
      setBusy(false);
    }
  }

  async function persist(action: "save" | "start"): Promise<boolean> {
    setSaving(true);
    setComposeMessage(null);
    try {
      const recipientIds = [...selected];
      const res = await fetch("/api/founder/outreach/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, subject, body: emailBody, sequence: activeSteps, recipientIds, stopOnReply, attachments }),
      });
      const data = (await res.json().catch(() => null)) as { status?: string; error?: string } | null;
      if (!res.ok) {
        setComposeMessage({ tone: "error", text: data?.error ?? "Something went wrong." });
        return false;
      }
      setDirty(false);
      setSavedRecipientIds(recipientIds);
      if (action === "start") {
        setStatus("queued");
        setComposeMessage({ tone: "ok", text: "Queued. Emails go out at the next send window." });
        // Statuses for the newly enrolled investors.
        void fetch("/api/founder/outreach/manual")
          .then((r) => (r.ok ? r.json() : null))
          .then((d: { recipients?: RecipientStatus[] } | null) => {
            if (Array.isArray(d?.recipients)) setRecipients(d.recipients);
          })
          .catch(() => {});
      } else {
        setComposeMessage({ tone: "ok", text: "Draft saved." });
      }
      return true;
    } catch {
      setComposeMessage({ tone: "error", text: "Network error. Try again." });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setComposeMessage(null);
    try {
      const res = await fetch("/api/founder/outreach/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body: emailBody, attachments }),
      });
      const data = (await res.json().catch(() => null)) as { sentTo?: string; error?: string } | null;
      setComposeMessage(
        res.ok
          ? { tone: "ok", text: `Test sent to ${data?.sentTo ?? "your inbox"}, with attachments.` }
          : { tone: "error", text: data?.error ?? "Couldn't send the test." },
      );
    } catch {
      setComposeMessage({ tone: "error", text: "Network error sending the test." });
    } finally {
      setTesting(false);
    }
  }

  async function draftEmails() {
    if (drafting) return;
    const contactId = selectedRows.find((c) => c.email)?.id ?? contactList[0]?.id;
    if (!contactId) {
      setComposeMessage({ tone: "error", text: "Select at least one investor first." });
      return;
    }
    setDrafting(true);
    setComposeMessage(null);
    try {
      const res = await fetch("/api/founder/outreach/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "intro", contactId, tone: tone === "Custom" ? customTone.trim() : tone }),
      });
      const data = (await res.json().catch(() => null)) as { draft?: { subject?: string; body?: string }; error?: string } | null;
      if (!res.ok) {
        setComposeMessage({ tone: "error", text: data?.error ?? "Couldn't draft the email." });
        return;
      }
      if (data?.draft?.subject) setSubject(data.draft.subject);
      if (data?.draft?.body) setEmailBody(data.draft.body);
      setDirty(true);
      setComposeMessage({ tone: "ok", text: "Draft ready. Edit anything before sending." });
    } catch {
      setComposeMessage({ tone: "error", text: "Network error drafting the email." });
    } finally {
      setDrafting(false);
    }
  }

  const btn = "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50";
  const menu = "absolute left-0 top-[calc(100%+5px)] z-40 min-w-[260px] rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg";
  const menuHead = "px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400";
  const menuItem = "flex w-full items-start gap-2.5 px-3 py-1.5 text-left text-[12.5px] text-slate-700 hover:bg-slate-50";
  const existingEmails = contactList.map((c) => c.email ?? "").filter(Boolean);
  const unsaved = dirty || savedRecipientIds.length !== selected.size || savedRecipientIds.some((id) => !selected.has(id));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Investor outreach</h2>
          <p className="mt-1 text-sm text-slate-600">
            Search your investors, tick the ones to contact, and send. Platform matches are handled under Automated.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status === "queued" ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Running</span>
          ) : null}
          {unsaved ? <span className="text-xs text-amber-600">Unsaved changes</span> : null}
          <button
            type="button"
            onClick={() => void persist("save").then((ok) => setMessage(ok ? { tone: "ok", text: "Saved." } : { tone: "error", text: "Couldn't save." }))}
            disabled={saving}
            className={`${btn} disabled:opacity-50`}
          >
            {saving ? "Saving…" : "Save campaign"}
          </button>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100">
        <FounderToolbar
          scope="manual-outreach"
          state={search}
          onChange={setSearch}
          count={filtered.length}
          countLabel={filtered.length === contactList.length ? "investors" : `of ${contactList.length} investors`}
          placeholder="Search name, firm, email, sector…"
          primary={
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPanel(panel === "add" ? "none" : "add")} className="cap-btn-primary rounded-lg px-3 py-1.5 text-[12.5px] font-semibold">
                New
              </button>
              <div ref={gearRef} className="relative">
                <button type="button" onClick={() => setGearOpen((v) => !v)} className={`${btn} px-2`} aria-label="Import and export" aria-expanded={gearOpen}>
                  <i className="ti ti-settings" aria-hidden="true" />
                </button>
                {gearOpen ? (
                  <div className={menu}>
                    <p className={menuHead}>Add recipients</p>
                    <button type="button" className={menuItem} onClick={() => { setGearOpen(false); setDialog("picker"); }}>
                      <i className="ti ti-address-book mt-0.5 text-base text-slate-500" aria-hidden="true" />
                      <span>Import from My contacts<span className="block text-[11px] text-slate-400">Pick from your Stage 3 contacts</span></span>
                    </button>
                    <button type="button" className={menuItem} onClick={() => { setGearOpen(false); setDialog("import"); }}>
                      <i className="ti ti-file-upload mt-0.5 text-base text-slate-500" aria-hidden="true" />
                      <span>Import file<span className="block text-[11px] text-slate-400">Drag and drop CSV or Excel</span></span>
                    </button>
                    <button type="button" className={menuItem} onClick={() => { setGearOpen(false); setDialog("linkedin"); }}>
                      <i className="ti ti-brand-linkedin mt-0.5 text-base text-slate-500" aria-hidden="true" />
                      <span>Import LinkedIn connections<span className="block text-[11px] text-slate-400">Connections.csv export</span></span>
                    </button>
                    <button type="button" className={menuItem} onClick={() => { setGearOpen(false); downloadTemplateCsv(); }}>
                      <i className="ti ti-download mt-0.5 text-base text-slate-500" aria-hidden="true" />
                      <span>Download CSV template</span>
                    </button>
                    {savedLists.length > 0 ? (
                      <>
                        <div className="my-1 border-t border-slate-100" />
                        <p className={menuHead}>Saved lists</p>
                        {savedLists.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            className={menuItem}
                            onClick={() => {
                              setGearOpen(false);
                              selectIds(l.contactIds, true);
                              setActiveListId(l.id);
                              setListName(l.name);
                              setMessage({ tone: "ok", text: `Loaded "${l.name}".` });
                            }}
                          >
                            <i className="ti ti-list-check mt-0.5 text-base text-slate-500" aria-hidden="true" />
                            <span>{l.name} <span className="text-slate-400">({l.contactIds.length})</span></span>
                          </button>
                        ))}
                      </>
                    ) : null}
                    <div className="my-1 border-t border-slate-100" />
                    <p className={menuHead}>Export</p>
                    <button type="button" className={menuItem} onClick={() => { setGearOpen(false); downloadCsv(filtered, "outreach-investors.csv"); }}>
                      <i className="ti ti-table-export mt-0.5 text-base text-slate-500" aria-hidden="true" />
                      <span>Export {filtered.length === contactList.length ? "all" : "filtered"} ({filtered.length})</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          }
          quick={[
            { key: "has_email", label: "Has an email" },
            { key: "not_contacted", label: "Not contacted yet" },
            { key: "selected", label: "Selected" },
            { key: "imported", label: "Imported", sep: true },
            { key: "added", label: "Added by you" },
          ]}
          fields={[
            { key: "source", label: "Source", options: SOURCE_ORDER },
            { key: "type", label: "Investor type", options: [...new Set(contactList.map((r) => r.investorType).filter((x): x is string => !!x))] },
            { key: "outreach", label: "Outreach status", options: ["Not contacted", "Queued", "Sent", "Opened", "Clicked", "Replied", "Stopped", "Skipped"] },
          ]}
          groups={[
            { id: "none", label: "None" },
            { id: "source", label: "Source" },
            { id: "type", label: "Investor type" },
            { id: "outreach", label: "Outreach status" },
          ]}
        />

        {panel === "add" ? (
          <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
            {([
              ["name", "Name", "Ada Lovelace"],
              ["firm", "Firm", "Analytical Ventures"],
              ["email", "Email", "ada@av.com"],
              ["type", "Investor type", "Angel"],
            ] as const).map(([k, label, ph]) => (
              <label key={k} className="min-w-[150px] flex-1 text-[11px] font-medium text-slate-500">
                {label}
                <input
                  value={form[k]}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  placeholder={ph}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800"
                />
              </label>
            ))}
            <button type="button" onClick={() => void addContact()} disabled={busy} className="cap-btn-primary rounded-lg px-4 py-2 text-[12.5px] font-semibold disabled:opacity-50">
              {busy ? "Saving…" : "Add investor"}
            </button>
          </div>
        ) : null}

        {selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-blue-100 bg-blue-50/60 px-4 py-2 text-[12.5px]">
            <span className="rounded-md bg-blue-100 px-2 py-0.5 font-semibold text-[#185FA5]">{selected.size} selected</span>
            {!allFilteredSelected && filtered.length > 0 ? (
              <button type="button" onClick={() => selectIds(filtered.map((r) => r.id))} className="font-medium text-[#1A6CE4] hover:underline">
                <i className="ti ti-arrow-right" aria-hidden="true" /> Select all {filtered.length}
              </button>
            ) : null}
            <button type="button" onClick={() => { setSelected(new Set()); setDirty(true); }} className="text-slate-500 hover:text-slate-700" aria-label="Clear selection">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => { setComposeMessage(null); setDialog("compose"); }}
              className="cap-btn-primary rounded-lg px-3 py-1.5 text-[12.5px] font-semibold"
            >
              <i className="ti ti-mail" aria-hidden="true" /> Send email
            </button>
            <div ref={actionsRef} className="relative">
              <button type="button" onClick={() => setActionsOpen((v) => !v)} className={btn} aria-expanded={actionsOpen}>
                Actions <i className="ti ti-chevron-down" aria-hidden="true" />
              </button>
              {actionsOpen ? (
                <div className={`${menu} left-auto right-0 min-w-[200px]`}>
                  <button type="button" className={menuItem} onClick={() => { setActionsOpen(false); setPanel("saveList"); }}>
                    <i className="ti ti-list-check mt-0.5 text-base text-slate-500" aria-hidden="true" />
                    <span>{activeListId ? "Update saved list" : "Save as list"}</span>
                  </button>
                  <button type="button" className={menuItem} onClick={() => { setActionsOpen(false); downloadCsv(selectedRows, "outreach-selected.csv"); }}>
                    <i className="ti ti-table-export mt-0.5 text-base text-slate-500" aria-hidden="true" />
                    <span>Export selected</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {panel === "saveList" ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <input
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="Name this list"
              className="w-64 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px]"
              aria-label="List name"
            />
            <button type="button" onClick={() => void saveList()} disabled={busy} className="cap-btn-primary rounded-lg px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-50">
              {activeListId ? "Update list" : "Save list"}
            </button>
            <button type="button" onClick={() => setPanel("none")} className="text-[12.5px] text-slate-500 hover:text-slate-700">Cancel</button>
            <span className="text-[11.5px] text-slate-400">{selected.size} investors</span>
          </div>
        ) : null}

        {message ? (
          <p className={`border-b border-slate-100 px-4 py-2 text-[12px] ${message.tone === "ok" ? "text-emerald-700" : "text-red-600"}`} role="status">
            {message.text}
          </p>
        ) : null}

        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-semibold text-slate-800">{contactList.length === 0 ? "Bring in your investors" : "No investors match your search"}</p>
            <p className="mx-auto mt-1 max-w-md text-[12.5px] text-slate-500">
              {contactList.length === 0
                ? "Drag and drop a CSV, Excel file or your LinkedIn Connections.csv, or add investors one by one."
                : "Clear a filter or try another name."}
            </p>
            {contactList.length === 0 ? (
              <div className="mt-3 flex justify-center gap-2">
                <button type="button" onClick={() => setDialog("import")} className="cap-btn-primary rounded-lg px-3 py-1.5 text-[12.5px] font-semibold">
                  Import contacts
                </button>
                <button type="button" onClick={() => setPanel("add")} className={btn}>Add an investor</button>
              </div>
            ) : null}
          </div>
        ) : (
          <table className="w-full table-fixed text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="w-10 px-4 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allFilteredSelected}
                    onChange={() => {
                      if (allFilteredSelected) {
                        setSelected((prev) => {
                          const n = new Set(prev);
                          filtered.forEach((r) => n.delete(r.id));
                          return n;
                        });
                        setDirty(true);
                      } else selectIds(filtered.map((r) => r.id));
                    }}
                  />
                </th>
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="hidden px-2 py-2 font-medium md:table-cell">Email</th>
                <th className="hidden w-32 px-2 py-2 font-medium lg:table-cell">Type</th>
                <th className="hidden w-32 px-2 py-2 font-medium sm:table-cell">Source</th>
                <th className="w-32 px-2 py-2 font-medium">Outreach</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const isCollapsed = collapsed.has(g.label);
                return (
                  <Fragment key={g.label || "all"}>
                    {g.label ? (
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="px-4 py-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsed((prev) => {
                                const n = new Set(prev);
                                if (n.has(g.label)) n.delete(g.label);
                                else n.add(g.label);
                                return n;
                              })
                            }
                            className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-700"
                            aria-expanded={!isCollapsed}
                          >
                            <i className={`ti ${isCollapsed ? "ti-chevron-right" : "ti-chevron-down"}`} aria-hidden="true" />
                            {g.label} <span className="rounded-full bg-blue-50 px-1.5 text-[11px] font-medium text-[#185FA5]">{g.rows.length}</span>
                          </button>
                        </td>
                      </tr>
                    ) : null}
                    {isCollapsed
                      ? null
                      : g.rows.map((r) => {
                          const on = selected.has(r.id);
                          const st = r.email ? statusByEmail.get(r.email.trim().toLowerCase()) : undefined;
                          const stage = st ? stageOf(st) : null;
                          return (
                            <tr key={r.id} className={`border-b border-slate-100 last:border-b-0 ${on ? "bg-blue-50/40" : "hover:bg-slate-50/60"}`}>
                              <td className="px-4 py-2.5">
                                <input type="checkbox" aria-label={`Select ${r.name}`} checked={on} onChange={() => toggle(r.id)} />
                              </td>
                              <td className="px-2 py-2.5">
                                <p className="truncate font-medium text-slate-900">{r.name}</p>
                                {r.firm ? <p className="truncate text-[11.5px] text-slate-400">{r.firm}</p> : null}
                              </td>
                              <td className="hidden truncate px-2 py-2.5 md:table-cell">
                                {r.email ? <span className="text-[#1A6CE4]">{r.email}</span> : <span className="text-amber-600">No email</span>}
                              </td>
                              <td className="hidden truncate px-2 py-2.5 text-slate-600 lg:table-cell">{r.investorType ?? "—"}</td>
                              <td className="hidden px-2 py-2.5 sm:table-cell">
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${SOURCE_STYLE[r.source] ?? SOURCE_STYLE["Added by you"]}`}>{r.source}</span>
                              </td>
                              <td className="px-2 py-2.5">
                                {stage ? (
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${stage.cls}`}>{stage.label}</span>
                                ) : (
                                  <span className="text-[12px] text-slate-400">Not contacted</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="border-t border-slate-100 px-5 py-3 text-[11.5px] leading-relaxed text-slate-400">
        Only your own investors appear here; this is the same address book as My contacts. Investors in the iCapOS network stay private
        until iCFO introduces you.
      </p>

      {dialog === "compose" ? (
        <OutreachComposer
          recipients={selectedRows}
          companyName={options?.onePager?.companyName ?? null}
          sector={options?.onePager?.industry ?? null}
          subject={subject}
          onSubject={(v) => { setSubject(v); markDirty(); }}
          body={emailBody}
          onBody={(v) => { setEmailBody(v); markDirty(); }}
          tone={tone}
          onTone={setTone}
          customTone={customTone}
          onCustomTone={setCustomTone}
          drafting={drafting}
          onDraft={() => void draftEmails()}
          attachments={attachments}
          onAttachments={(v) => { setAttachments(v); markDirty(); }}
          options={options}
          sequence={sequence}
          autoFollowUps={autoFollowUps}
          onAutoFollowUps={(v) => { setAutoFollowUps(v); markDirty(); }}
          stopOnReply={stopOnReply}
          onStopOnReply={(v) => { setStopOnReply(v); markDirty(); }}
          running={status === "queued"}
          droppedActive={droppedActive}
          testing={testing}
          onSendTest={() => void sendTest()}
          saving={saving}
          onSave={() => void persist("save")}
          onSend={() => void persist("start")}
          message={composeMessage}
          onClose={() => setDialog("none")}
        />
      ) : null}

      {dialog === "picker" ? (
        <MyContactsPicker
          contacts={contactList}
          selected={selected}
          onClose={() => setDialog("none")}
          onAdd={(ids) => {
            selectIds(ids);
            setDialog("none");
            setMessage({ tone: "ok", text: `${ids.length} investor${ids.length === 1 ? "" : "s"} added to this outreach.` });
          }}
        />
      ) : null}

      {dialog === "import" || dialog === "linkedin" ? (
        <ContactImportDialog
          mode={dialog === "linkedin" ? "linkedin" : "file"}
          existingEmails={existingEmails}
          onClose={() => setDialog("none")}
          onImported={async (count) => {
            await refreshContacts();
            setDialog("none");
            setSearch((s) => ({ ...s, groupBy: "source" }));
            setMessage({ tone: "ok", text: `${count.toLocaleString()} contact${count === 1 ? "" : "s"} imported. They're under Imported; tick the ones to contact.` });
          }}
        />
      ) : null}
    </section>
  );
}
