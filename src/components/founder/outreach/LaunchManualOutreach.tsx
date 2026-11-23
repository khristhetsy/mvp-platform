"use client";

/**
 * Launch my manual outreach. Replaces the Manual outreach list page.
 *
 * Opens on the founder's campaign (counts plus a Sent and replies list). "Launch a new
 * wave" opens a five step wizard: Investors, Message, Attachments, Follow ups, Review
 * and send. Everything underneath is the existing manual outreach stack: the same
 * /api/founder/outreach/manual save and start, test send, AI drafts, plan caps,
 * attachments and per investor stop. Nothing about sending or caps changes.
 */

import Link from "next/link";
import { ContactImportDialog } from "@/components/founder/outreach/ContactImportDialog";
import { MatchFromDirectoryWizard } from "@/components/founder/investor-directory/MatchFromDirectoryWizard";
import type { HoldStatus } from "@/lib/investor-directory/limits";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_BODY,
  DEFAULT_SEQUENCE,
  DEFAULT_SUBJECT,
  SOURCE_ORDER,
  fetchContacts,
  fetchLists,
  fromAudience,
  stageOf,
  type OutreachAudienceContact,
} from "@/components/founder/ManualOutreachBuilder";
import {
  DISCLAIMER,
  MERGE_FIELDS,
  TONE_PRESETS,
  Toggle,
  firstNameOf,
  kb,
  nextSendWindow,
  type SeqStep,
} from "@/components/founder/outreach/OutreachComposer";
import type { AttachmentOptions, OutreachContact, RecipientStatus } from "@/components/founder/outreach/types";
import {
  DEFAULT_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  normalizeAttachments,
  type ManualAttachments,
} from "@/lib/outreach/manual-attachments";

type Msg = { tone: "ok" | "error"; text: string } | null;
type SavedList = { id: string; name: string; contactIds: string[] };

const STEPS = ["Investors", "Message", "Attachments", "Follow ups", "Review and send"] as const;
/** One line per wizard step, shown under the stepper. */
const STEP_HELP = [
  "Select the investors you want to reach, then press Next. A small, researched first wave works better than a blast. Contacts with no email are skipped.",
  "Write your subject and message, or let the AI agent draft it. Check the preview on the right, then press Next.",
  "Choose what to attach, such as your one pager, an agent link or data room PDFs. Attachments are optional. Press Next when ready.",
  "Turn automatic follow ups on or off, and choose whether to stop when an investor replies. Press Next to continue.",
  "Check the counts, tick the three confirmations, then press Start campaign. Only selected investors with an email address receive it.",
] as const;
const CHECKS = [
  "I have checked the message and merge fields in the preview",
  "I make no promise of returns and do not describe myself as an investment adviser",
  "I understand each email carries the disclaimer and an unsubscribe link, and skips anyone on the suppression list",
] as const;

const btn = "rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const btnPrimary = "cap-btn-primary rounded-lg px-4 py-2 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50";
const input = "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800";

function Banner({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p className={`mt-3 rounded-lg px-3 py-2 text-[12.5px] ${msg.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>
  );
}

export function LaunchManualOutreach({ contacts }: { contacts: OutreachAudienceContact[] }) {
  // ---- Campaign ----
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [sequence] = useState<SeqStep[]>(DEFAULT_SEQUENCE);
  const [autoFollowUps, setAutoFollowUps] = useState(true);
  const [stopOnReply, setStopOnReply] = useState(true);
  const [attachments, setAttachments] = useState<ManualAttachments>({ ...DEFAULT_ATTACHMENTS });
  const [status, setStatus] = useState<"draft" | "queued">("draft");
  const [recipients, setRecipients] = useState<RecipientStatus[]>([]);
  const [tone, setTone] = useState("Warm");
  const [customTone, setCustomTone] = useState("");

  // ---- Data ----
  const [contactList, setContactList] = useState<OutreachContact[]>(() => contacts.map(fromAudience));
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [options, setOptions] = useState<AttachmentOptions | null>(null);
  const [emailCap, setEmailCap] = useState<{ cap: number; used: number; resetsLabel: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  // ---- UI ----
  const [view, setView] = useState<"home" | "wizard">("home");
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [hold, setHold] = useState<HoldStatus | null>(null);
  const [form, setForm] = useState({ name: "", firm: "", email: "", type: "" });
  const [docsOpen, setDocsOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [message, setMessage] = useState<Msg>(null);

  type CampaignPayload = {
    campaign?: {
      status?: string;
      emailSubject?: string;
      emailBody?: string;
      recipientIds?: string[];
      stopOnReply?: boolean;
      sequence?: SeqStep[];
      attachments?: unknown;
    } | null;
    recipients?: RecipientStatus[];
  };

  const loadCampaign = useCallback(async (): Promise<CampaignPayload | null> => {
    try {
      const res = await fetch("/api/founder/outreach/manual");
      return res.ok ? ((await res.json()) as CampaignPayload) : null;
    } catch {
      return null; // the page still works from what it has
    }
  }, []);

  const loadHold = useCallback(async () => {
    try {
      const res = await fetch("/api/founder/investor-contacts");
      if (!res.ok) return;
      const body = (await res.json()) as { hold?: HoldStatus | null };
      setHold(body.hold ?? null);
    } catch {
      /* the import dialog works without the plan meter */
    }
  }, []);

  const applyCampaign = useCallback((data: CampaignPayload | null) => {
    if (!data) return;
    const c = data.campaign;
    if (c) {
      if (c.emailSubject) setSubject(c.emailSubject);
      if (c.emailBody) setBody(c.emailBody);
      if (Array.isArray(c.recipientIds)) setSelected(new Set(c.recipientIds));
      if (Array.isArray(c.sequence) && c.sequence.length > 0) setAutoFollowUps(c.sequence.length > 1);
      if (typeof c.stopOnReply === "boolean") setStopOnReply(c.stopOnReply);
      setAttachments(normalizeAttachments(c.attachments));
      if (c.status === "queued") setStatus("queued");
    }
    if (Array.isArray(data.recipients)) setRecipients(data.recipients);
  }, []);

  const reloadCampaign = useCallback(async () => {
    applyCampaign(await loadCampaign());
  }, [applyCampaign, loadCampaign]);

  useEffect(() => {
    let active = true;
    void fetchContacts().then((rows) => active && rows && setContactList(rows));
    void fetchLists().then((lists) => active && lists && setSavedLists(lists));
    void fetch("/api/founder/investor-contacts")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { hold?: HoldStatus | null } | null) => active && d && setHold(d.hold ?? null))
      .catch(() => {});
    void fetch("/api/founder/outreach/email-cap")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { cap?: number; used?: number; resetsLabel?: string } | null) => {
        if (active && d && typeof d.cap === "number" && typeof d.used === "number") setEmailCap({ cap: d.cap, used: d.used, resetsLabel: d.resetsLabel ?? "" });
      })
      .catch(() => {});
    void fetch("/api/founder/outreach/attachments")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AttachmentOptions | null) => active && d && setOptions(d))
      .catch(() => {});
    void loadCampaign().then((d) => {
      if (!active) return;
      applyCampaign(d);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [applyCampaign, loadCampaign]);

  // ---- Derived ----
  const statusByEmail = useMemo(() => {
    const m = new Map<string, RecipientStatus>();
    for (const r of recipients) m.set(r.email.trim().toLowerCase(), r);
    return m;
  }, [recipients]);
  const contactByEmail = useMemo(() => {
    const m = new Map<string, OutreachContact>();
    for (const c of contactList) if (c.email) m.set(c.email.trim().toLowerCase(), c);
    return m;
  }, [contactList]);

  const selectedRows = contactList.filter((c) => selected.has(c.id));
  const sendable = selectedRows.filter((c) => c.email);
  const noEmail = selectedRows.length - sendable.length;
  const newCount = sendable.filter((c) => !statusByEmail.has((c.email ?? "").trim().toLowerCase())).length;
  const overCap = emailCap !== null && emailCap.cap > 0 && emailCap.used + newCount > emailCap.cap;
  const capReached = emailCap !== null && emailCap.cap > 0 && emailCap.used >= emailCap.cap;
  const droppedActive =
    status === "queued"
      ? recipients.filter((r) => r.status === "active" && !r.repliedAt && !sendable.some((c) => (c.email ?? "").trim().toLowerCase() === r.email.trim().toLowerCase())).length
      : 0;
  const activeSteps = autoFollowUps ? sequence : sequence.slice(0, 1);

  const outreachLabel = (c: OutreachContact) => {
    const r = c.email ? statusByEmail.get(c.email.trim().toLowerCase()) : undefined;
    return r ? stageOf(r).label : "Not contacted";
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contactList;
    return contactList.filter((c) => [c.name, c.firm ?? "", c.email ?? "", c.investorType ?? "", c.sectors ?? ""].join(" ").toLowerCase().includes(q));
  }, [contactList, query]);

  const grouped = useMemo(
    () => SOURCE_ORDER.map((g) => ({ label: g, rows: filtered.filter((c) => c.source === g) })).filter((g) => g.rows.length > 0),
    [filtered],
  );

  const preview = sendable.find((c) => c.id === previewId) ?? sendable[0] ?? null;
  const onePager = options?.onePager ?? null;
  const docs = options?.documents ?? [];
  const chosenDocs = docs.filter((d) => attachments.documentIds.includes(d.id));
  const docBytes = chosenDocs.reduce((s, d) => s + (d.sizeBytes ?? 0), 0);
  const attachmentCount = (attachments.onePagerPdf ? 1 : 0) + (attachments.onePagerLink ? 1 : 0) + (attachments.agentLink ? 1 : 0) + attachments.documentIds.length;

  function merge(text: string): string {
    return text
      .replaceAll("{{first_name}}", firstNameOf(preview?.name))
      .replaceAll("{{company}}", onePager?.companyName ?? "your company")
      .replaceAll("{{sector}}", onePager?.industry ?? "its sector")
      .replaceAll("{{founder_preview}}", onePager?.published ? (onePager.url ?? "") : "")
      .replaceAll("{{ir_agent}}", options?.agent?.url ?? "(your IR agent link, once live)");
  }

  function canNext(): boolean {
    if (step === 0) return sendable.length > 0;
    if (step === 1) return subject.trim().length > 0 && body.trim().length > 0;
    return true;
  }

  // ---- Actions ----
  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  /** Reloads My contacts and ticks whatever just arrived, so new contacts land in this wave. */
  async function reloadAndSelectNew(note: string) {
    const before = new Set(contactList.map((c) => c.id));
    const rows = await fetchContacts();
    if (!rows) return;
    setContactList(rows);
    const fresh = rows.filter((c) => !before.has(c.id)).map((c) => c.id);
    if (fresh.length > 0) setSelected((prev) => new Set([...prev, ...fresh]));
    setMessage({ tone: "ok", text: note });
    void loadHold();
  }

  async function addContact() {
    if (!form.name.trim()) return setMessage({ tone: "error", text: "Enter the investor's name." });
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/founder/investor-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investor_name: form.name.trim(), firm_name: form.firm.trim() || undefined, email: form.email.trim(), investor_type: form.type.trim() || undefined }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) return setMessage({ tone: "error", text: data?.error ?? "Couldn't add that investor. Check the email and try again." });
      setForm({ name: "", firm: "", email: "", type: "" });
      setAddOpen(false);
      await reloadAndSelectNew("Investor added to My contacts and to this wave.");
    } finally {
      setBusy(false);
    }
  }

  async function persist(action: "save" | "start"): Promise<boolean> {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/founder/outreach/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, subject, body, sequence: activeSteps, recipientIds: [...selected], stopOnReply, attachments }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setMessage({ tone: "error", text: data?.error ?? "Something went wrong." });
        return false;
      }
      if (action === "start") setStatus("queued");
      else setMessage({ tone: "ok", text: "Draft saved." });
      return true;
    } catch {
      setMessage({ tone: "error", text: "Network error. Try again." });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function start() {
    if (await persist("start")) {
      await reloadCampaign();
      setDone(true);
    }
  }

  async function sendTest() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/founder/outreach/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, attachments }),
      });
      const data = (await res.json().catch(() => null)) as { sentTo?: string; error?: string } | null;
      setMessage(res.ok ? { tone: "ok", text: `Test sent to ${data?.sentTo ?? "your inbox"}, with attachments.` } : { tone: "error", text: data?.error ?? "Couldn't send the test." });
    } catch {
      setMessage({ tone: "error", text: "Network error sending the test." });
    } finally {
      setTesting(false);
    }
  }

  async function draftEmail() {
    if (drafting) return;
    const contactId = sendable[0]?.id ?? contactList[0]?.id;
    if (!contactId) return setMessage({ tone: "error", text: "Select at least one investor first." });
    setDrafting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/founder/outreach/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "intro", contactId, tone: tone === "Custom" ? customTone.trim() : tone }),
      });
      const data = (await res.json().catch(() => null)) as { draft?: { subject?: string; body?: string }; error?: string } | null;
      if (!res.ok) return setMessage({ tone: "error", text: data?.error ?? "Couldn't draft the email." });
      if (data?.draft?.subject) setSubject(data.draft.subject);
      if (data?.draft?.body) setBody(data.draft.body);
      setMessage({ tone: "ok", text: "Draft ready. Edit anything before sending." });
    } catch {
      setMessage({ tone: "error", text: "Network error drafting the email." });
    } finally {
      setDrafting(false);
    }
  }

  async function stopOne(contactId: string) {
    setMessage(null);
    try {
      const res = await fetch(`/api/founder/investor-contacts/${contactId}/send`, { method: "DELETE" });
      if (!res.ok) return setMessage({ tone: "error", text: "Couldn't stop that investor." });
      await reloadCampaign();
    } catch {
      setMessage({ tone: "error", text: "Network error. Try again." });
    }
  }

  function openWizard() {
    setStep(0);
    setDone(false);
    setChecks([false, false, false]);
    setMessage(null);
    setView("wizard");
  }

  function backToHome() {
    setView("home");
    setDone(false);
    setMessage(null);
    void reloadCampaign();
  }

  // ---- Views ----
  const sentCount = recipients.filter((r) => r.sentAt).length;
  const openedCount = recipients.filter((r) => r.openedAt).length;
  const repliedCount = recipients.filter((r) => r.repliedAt).length;

  const home = (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-600">
          {recipients.length > 0
            ? `Your campaign is ${status === "queued" ? "running" : "saved"}. Next send window: ${nextSendWindow()}.`
            : "You have not sent any manual outreach yet. Launch your first wave in five short steps."}
        </p>
        <button
          type="button"
          onClick={openWizard}
          disabled={capReached}
          title={capReached ? `Email limit reached. Sending resumes ${emailCap?.resetsLabel}.` : undefined}
          className={`${btnPrimary} ml-auto`}
        >
          Launch a new wave
        </button>
      </div>
      <Banner msg={message} />
      {recipients.length > 0 ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Investors in sequence", recipients.length],
              ["Sent", sentCount],
              ["Opened", openedCount],
              ["Replied", repliedCount],
            ].map(([label, n]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <b className="block text-xl text-slate-900">{n}</b>
                <span className="text-xs text-slate-500">{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-slate-200">
            <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Sent and replies</h3>
            {recipients.map((r) => {
              const st = stageOf(r);
              const c = contactByEmail.get(r.email.trim().toLowerCase());
              const canStop = !!c && !r.repliedAt && r.status !== "stopped" && r.status !== "skipped";
              return (
                <div key={r.email} className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-900">
                      {r.name ?? r.email}
                      {c?.firm ? <span className="font-normal text-slate-500"> at {c.firm}</span> : null}
                    </p>
                    <p className="truncate text-[11.5px] text-slate-500">{r.email}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                  {canStop && c ? (
                    <button type="button" className="rounded-md border border-slate-200 px-2 py-1 text-[11.5px] text-slate-600 hover:bg-slate-50" onClick={() => void stopOne(c.id)}>
                      Stop
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11.5px] text-slate-500">Investors already in the sequence keep their place when you launch a new wave.</p>
        </>
      ) : null}
    </div>
  );

  const stepInvestors = (
    <div>
      <h3 className="text-base font-semibold text-slate-900">Who do you want to reach?</h3>
      <p className="mb-3 text-[13px] text-slate-500">Same address book as My contacts. A small, researched first wave works better than a blast.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${input} min-w-[160px] flex-1`} placeholder="Search name, firm, email, sector" value={query} onChange={(e) => setQuery(e.target.value)} />
        {savedLists.length > 0 ? (
          <select
            className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
            value=""
            onChange={(e) => {
              const l = savedLists.find((x) => x.id === e.target.value);
              if (l) setSelected(new Set(l.contactIds));
            }}
          >
            <option value="">Saved lists</option>
            {savedLists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.contactIds.length})
              </option>
            ))}
          </select>
        ) : null}
        <div className="relative">
          <button type="button" className={btnPrimary} aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
            + Add contacts <i className="ti ti-chevron-down" aria-hidden="true" />
          </button>
          {menuOpen ? (
            <div role="menu" className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
              {(
                [
                  ["Add one contact", "Type in the details", () => setAddOpen(true)],
                  ["Import a file", "CSV or Excel, map the columns", () => setImportOpen(true)],
                  ["Import from Investor directory", "Find investors and add them here", () => setDirectoryOpen(true)],
                ] as const
              ).map(([label, hint, run]) => (
                <button
                  key={label}
                  type="button"
                  role="menuitem"
                  className="block w-full rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-900 hover:bg-slate-50"
                  onClick={() => {
                    setMenuOpen(false);
                    run();
                  }}
                >
                  {label}
                  <span className="block text-[11.5px] text-slate-500">{hint}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button type="button" className={btnPrimary} disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>
          Next
        </button>
      </div>
      {addOpen ? (
        <div className="mt-2 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-5">
          {(["name", "firm", "email", "type"] as const).map((k) => (
            <input
              key={k}
              className={input}
              placeholder={{ name: "Name", firm: "Firm", email: "Email", type: "Investor type" }[k]}
              value={form[k]}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
            />
          ))}
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => void addContact()}>
            {busy ? "Saving…" : "Add"}
          </button>
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-slate-500">
        <button type="button" className="font-medium text-[#1A6CE4] hover:underline" onClick={() => setSelected((p) => new Set([...p, ...filtered.map((c) => c.id)]))}>
          Select all {filtered.length}
        </button>
        <button type="button" className="hover:text-slate-700" onClick={() => setSelected(new Set())}>
          Clear
        </button>
        <Link href="/founder/investor-directory" className="ml-auto text-[#1A6CE4] hover:underline">
          Import in the Investor directory
        </Link>
      </div>
      {contactList.length === 0 ? <p className="mt-4 text-sm text-slate-500">No investors yet. Add one above or import them in the Investor directory.</p> : null}
      {grouped.map((g) => (
        <div key={g.label}>
          <p className="px-1 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">{g.label}</p>
          {g.rows.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-1 py-2 hover:bg-slate-50">
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
              <span className="min-w-0 flex-1">
                <span className="text-[13px] font-medium text-slate-900">{c.name}</span>
                {c.firm ? <span className="text-[13px] text-slate-500"> at {c.firm}</span> : null}
                <span className="block truncate text-[11.5px] text-slate-500">
                  {[c.investorType, c.sectors].filter(Boolean).join(" · ")}
                  {!c.email ? <span className="text-amber-700"> · no email, will be skipped</span> : null}
                </span>
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{outreachLabel(c)}</span>
            </label>
          ))}
        </div>
      ))}
      {noEmail > 0 ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">{noEmail} selected without an email will be skipped.</p> : null}
      {importOpen ? (
        <ContactImportDialog
          hold={hold}
          existingEmails={contactList.map((c) => c.email ?? "").filter(Boolean)}
          onClose={() => setImportOpen(false)}
          onImported={async (count) => {
            setImportOpen(false);
            await reloadAndSelectNew(`${count.toLocaleString()} contact${count === 1 ? "" : "s"} imported to My contacts and added to this wave.`);
          }}
        />
      ) : null}
      {directoryOpen ? (
        <MatchFromDirectoryWizard
          onClose={() => setDirectoryOpen(false)}
          onImported={() => {
            setDirectoryOpen(false);
            void reloadAndSelectNew("Investors imported to My contacts and added to this wave.");
          }}
        />
      ) : null}
    </div>
  );

  const stepMessage = (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Write your first email</h3>
        <p className="mb-3 text-[13px] text-slate-500">One message goes to everyone. Merge fields fill in per investor.</p>
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="mr-0.5 text-xs text-slate-500">AI tone</span>
          {TONE_PRESETS.map((t) => (
            <button key={t} type="button" onClick={() => setTone(t)} className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone === t ? "border-[#1A6CE4] bg-[#1A6CE4] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"}`}>
              {t}
            </button>
          ))}
          <button type="button" onClick={() => setTone("Custom")} className={`rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium ${tone === "Custom" ? "border-[#1A6CE4] text-[#1A6CE4]" : "border-slate-300 text-slate-500"}`}>
            Custom
          </button>
          {tone === "Custom" ? <input value={customTone} onChange={(e) => setCustomTone(e.target.value)} placeholder="punchy, founder to founder" className="w-44 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs" /> : null}
          <button type="button" onClick={() => void draftEmail()} disabled={drafting} className="ml-auto rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">
            {drafting ? "Drafting…" : "AI agent draft"}
          </button>
        </div>
        <label className="mb-1 mt-3 block text-xs font-medium text-slate-500" htmlFor="lmo-subject">Subject</label>
        <input id="lmo-subject" className={input} value={subject} onChange={(e) => setSubject(e.target.value)} />
        <label className="mb-1 mt-3 block text-xs font-medium text-slate-500" htmlFor="lmo-body">Message</label>
        <textarea id="lmo-body" rows={9} className={`${input} leading-relaxed`} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {MERGE_FIELDS.map((f) => (
            <button key={f} type="button" onClick={() => setBody((b) => `${b}${f}`)} className="rounded bg-blue-50 px-2 py-0.5 text-[11px] text-[#185FA5] hover:bg-blue-100">
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="self-start rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="mb-1 text-xs font-medium text-slate-500">Preview as</p>
        <select className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm" value={preview?.id ?? ""} onChange={(e) => setPreviewId(e.target.value)}>
          {sendable.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-[12.5px] text-slate-800">
          <b>{merge(subject)}</b>
          {"\n\n"}
          {merge(body)}
          <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-400">{DISCLAIMER} Unsubscribe link added automatically.</p>
        </div>
      </div>
    </div>
  );

  const attCard = (on: boolean) =>
    `flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left ${on ? "border-2 border-[#1A6CE4] bg-blue-50/50" : "border border-slate-200 hover:border-slate-300"}`;
  const stepAttachments = (
    <div>
      <h3 className="text-base font-semibold text-slate-900">Add attachments</h3>
      <p className="mb-3 text-[13px] text-slate-500">Optional. Files over 10 MB in total are left off, so a link is often better.</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" className={attCard(attachments.onePagerPdf)} aria-pressed={attachments.onePagerPdf} onClick={() => setAttachments({ ...attachments, onePagerPdf: !attachments.onePagerPdf })}>
          <i className="ti ti-file-type-pdf mt-0.5 text-lg text-[#1A6CE4]" aria-hidden="true" />
          <span><span className="block text-[13px] font-medium text-slate-900">One pager PDF</span><span className="block text-[11px] text-slate-500">Made from your profile</span></span>
        </button>
        <button type="button" className={attCard(attachments.onePagerLink)} aria-pressed={attachments.onePagerLink} onClick={() => setAttachments({ ...attachments, onePagerLink: !attachments.onePagerLink })}>
          <i className="ti ti-link mt-0.5 text-lg text-[#1A6CE4]" aria-hidden="true" />
          <span><span className="block text-[13px] font-medium text-slate-900">One pager link</span><span className="block text-[11px] text-slate-500">{onePager?.published ? "Live page, tracks clicks" : "Needs a published profile"}</span></span>
        </button>
        <button type="button" className={attCard(attachments.agentLink)} aria-pressed={attachments.agentLink} onClick={() => setAttachments({ ...attachments, agentLink: !attachments.agentLink })}>
          <i className="ti ti-message-chatbot mt-0.5 text-lg text-[#1A6CE4]" aria-hidden="true" />
          <span><span className="block text-[13px] font-medium text-slate-900">Agent link</span><span className="block text-[11px] text-slate-500">{options?.agent ? "Your IR agent, tracks the email channel" : "Go live in My IR Agent first"}</span></span>
        </button>
        <button type="button" className={attCard(attachments.documentIds.length > 0 || docsOpen)} aria-expanded={docsOpen} onClick={() => setDocsOpen((v) => !v)}>
          <i className="ti ti-folder mt-0.5 text-lg text-[#1A6CE4]" aria-hidden="true" />
          <span><span className="block text-[13px] font-medium text-slate-900">From data room</span><span className="block text-[11px] text-slate-500">{attachments.documentIds.length > 0 ? `${attachments.documentIds.length} chosen` : "Pitch deck, financials"}</span></span>
        </button>
      </div>
      {docsOpen ? (
        <div className="mt-2 rounded-lg border border-slate-200">
          {docs.length === 0 ? (
            <p className="px-3 py-3 text-xs text-slate-500">No PDFs in your data room yet. Upload them under Stage 2, Data room.</p>
          ) : (
            <ul className="max-h-48 overflow-y-auto">
              {docs.map((d) => (
                <li key={d.id} className="border-b border-slate-100 last:border-b-0">
                  <label className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-[12.5px] hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={attachments.documentIds.includes(d.id)}
                      onChange={() =>
                        setAttachments({
                          ...attachments,
                          documentIds: attachments.documentIds.includes(d.id) ? attachments.documentIds.filter((x) => x !== d.id) : [...attachments.documentIds, d.id],
                        })
                      }
                    />
                    <span className="min-w-0 flex-1 truncate text-slate-800">{d.name}</span>
                    <span className="shrink-0 text-[11px] text-slate-400">{kb(d.sizeBytes)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {attachments.onePagerLink && !onePager?.published ? <p className="mt-2 text-[11.5px] text-amber-700">Your profile isn&apos;t published, so no link is added. Publish it from Public Profile to share the live page.</p> : null}
      {docBytes > MAX_ATTACHMENT_BYTES - 1024 * 1024 ? <p className="mt-2 text-[11.5px] text-amber-700">Attachments are over 9 MB. Files past the 10 MB limit are left off; consider sending the link instead.</p> : null}
    </div>
  );

  const stepFollowUps = (
    <div>
      <h3 className="text-base font-semibold text-slate-900">Follow ups</h3>
      <p className="mb-3 text-[13px] text-slate-500">Most replies come after a follow up. Each one goes out after the day shown.</p>
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
        <Toggle on={autoFollowUps} onClick={() => setAutoFollowUps((v) => !v)} label="Automatic follow ups" />
        <div>
          <p className="text-[13px] font-medium text-slate-900">Automatic follow ups</p>
          <p className="text-[11.5px] text-slate-500">{sequence.map((s) => `Day ${s.dayOffset}`).join(", ")}</p>
        </div>
      </div>
      <ol className="my-3 ml-3 border-l-2 border-slate-300 pl-5">
        {sequence.map((s, i) => (
          <li key={s.label} className={`mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] ${i > 0 && !autoFollowUps ? "opacity-40" : ""}`}>
            <b>{i + 1}. {s.label}</b> <span className="text-slate-500">· Day {s.dayOffset}</span>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
        <Toggle on={stopOnReply} onClick={() => setStopOnReply((v) => !v)} label="Stop on reply" />
        <div>
          <p className="text-[13px] font-medium text-slate-900">Stop when the investor replies</p>
          <p className="text-[11.5px] text-slate-500">Recommended. Replies are forwarded to you.</p>
        </div>
      </div>
    </div>
  );

  const stepReview = (
    <div>
      <h3 className="mb-3 text-base font-semibold text-slate-900">Review and send</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [sendable.length, "Investors"],
          [activeSteps.length, "Emails in sequence"],
          [attachmentCount, "Attachments"],
          [stopOnReply ? "On" : "Off", "Stop on reply"],
        ].map(([n, label]) => (
          <div key={String(label)} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <b className="block text-xl text-slate-900">{n}</b>
            <span className="text-xs text-slate-500">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={btn} disabled={testing} onClick={() => void sendTest()}>
          {testing ? "Sending test…" : "Send me a test email"}
        </button>
      </div>
      <p className="mt-3 text-[12px] text-slate-500">
        Emails go out at the next send window, {nextSendWindow()}. Investors already in a running sequence keep their place; only new ones get the first email.
      </p>
      {droppedActive > 0 ? (
        <p className="mt-2 text-[12px] text-amber-700">
          {droppedActive} investor{droppedActive === 1 ? " is" : "s are"} in the running sequence but not selected. Starting stops their remaining follow ups. Go back and select them to keep them in.
        </p>
      ) : null}
      <p className="mb-1 mt-4 text-xs font-medium text-slate-500">Before you send</p>
      {CHECKS.map((c, i) => (
        <label key={c} className={`mb-2 flex cursor-pointer gap-3 rounded-lg border px-3 py-2 text-[13px] ${checks[i] ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}>
          <input type="checkbox" checked={checks[i]} onChange={() => setChecks((p) => p.map((v, j) => (j === i ? !v : v)))} />
          <span>{c}</span>
        </label>
      ))}
      {overCap ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">This would pass your plan email limit. Sending resumes {emailCap?.resetsLabel}.</p> : null}
    </div>
  );

  const doneView = (
    <div className="py-8 text-center">
      <div className="text-4xl text-emerald-600">&#10003;</div>
      <h3 className="mt-2 text-lg font-semibold text-slate-900">Campaign queued</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
        {sendable.length} investors get email 1 at the next send window.
        {autoFollowUps ? " Follow ups are set for day 3 and day 7." : ""}
        {stopOnReply ? " They stop on reply." : ""}
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <button type="button" className={btnPrimary} onClick={backToHome}>View sent and replies</button>
        <button type="button" className={btn} onClick={openWizard}>Start another</button>
      </div>
    </div>
  );

  const backButton = (
    <button type="button" className={btn} disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</button>
  );
  const primaryButton =
    step < 4 ? (
      <button type="button" className={btnPrimary} disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>Next</button>
    ) : (
      <button type="button" className={btnPrimary} disabled={saving || overCap || !checks.every(Boolean) || sendable.length === 0} onClick={() => void start()}>
        {saving ? "Starting…" : "Start campaign"}
      </button>
    );

  const wizard = (
    <div>
      {!done ? (
        <ol className="mb-4 flex gap-1.5 overflow-x-auto">
          {STEPS.map((name, i) => (
            <li key={name} className="min-w-[108px] flex-1">
              <button
                type="button"
                onClick={() => (i <= step || canNext() ? setStep(i) : undefined)}
                className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left ${i === step ? "border-[#1A6CE4] bg-blue-50" : "border-slate-200 bg-white"}`}
              >
                <span className={`inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${i < step ? "bg-emerald-600 text-white" : i === step ? "bg-[#1A6CE4] text-white" : "bg-slate-200 text-slate-600"}`}>{i < step ? "✓" : i + 1}</span>
                <span className="text-[12.5px] font-semibold text-slate-800">{name}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      {!done ? (
        <p className="mb-4 rounded-lg bg-blue-50 px-3 py-2.5 text-[13px] leading-relaxed text-slate-800">
          <b>Step {step + 1} of 5.</b> {STEP_HELP[step]}
        </p>
      ) : null}
      {!done && step > 0 ? <div className="mb-4 flex items-center justify-between gap-2">{backButton}{primaryButton}</div> : null}
      {done ? doneView : [stepInvestors, stepMessage, stepAttachments, stepFollowUps, stepReview][step]}
      {!done ? <Banner msg={message} /> : null}
      {!done ? (
        <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
          {backButton}
          <div className="flex items-center gap-2">
            <button type="button" className={btn} disabled={saving} onClick={() => void persist("save")}>{saving ? "Saving…" : "Save draft"}</button>
            {primaryButton}
          </div>
        </div>
      ) : null}
      {!done && emailCap && emailCap.cap > 0 ? (
        <p className="mt-3 text-[11.5px] text-slate-500">
          Plan emails this period: {emailCap.used + newCount} of {emailCap.cap} after this start.
        </p>
      ) : null}
    </div>
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 px-5 pt-5">
        <h2 className="text-lg font-semibold text-slate-950">Launch my manual outreach</h2>
        {status === "queued" ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Running</span> : null}
        {view === "wizard" ? (
          <button type="button" className={`${btn} ml-auto px-2.5 py-1 text-[12px]`} onClick={backToHome}>
            Back to my campaign
          </button>
        ) : null}
      </div>
      <div className="px-5 pb-5 pt-4">{!loaded && view === "home" ? <p className="text-sm text-slate-500">Loading…</p> : view === "home" ? home : wizard}</div>
      <p className="border-t border-slate-100 px-5 py-3 text-[11.5px] leading-relaxed text-slate-400">
        Only your own investors appear here; this is the same address book as My contacts. Investors in the iCapOS network stay private until iCFO introduces you.
      </p>
    </section>
  );
}
