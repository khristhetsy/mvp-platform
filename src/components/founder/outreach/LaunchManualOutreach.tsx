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

import { OdooSearchBar, EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";
import { ToolbarGear, type GearItem } from "@/components/admin/ToolbarGear";
import { applySearch, groupRows } from "@/components/founder/FounderToolbar";
import { Highlight } from "@/components/ui/SearchStatus";
import { ContactImportDialog } from "@/components/founder/outreach/ContactImportDialog";
import { MatchFromDirectoryWizard, type DirectoryDefaults } from "@/components/founder/investor-directory/MatchFromDirectoryWizard";
import type { HoldStatus } from "@/lib/investor-directory/limits";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
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
import { contactFit, fitCompany } from "@/lib/outreach/contact-fit";
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

type ColKey = "contact" | "email" | "type" | "sectors" | "fit" | "status" | "source";
/** The step 1 table columns. Contact is always shown. */
const COLUMNS: { key: ColKey; label: string }[] = [
  { key: "contact", label: "Contact" },
  { key: "email", label: "Email" },
  { key: "type", label: "Type" },
  { key: "sectors", label: "Sectors" },
  { key: "fit", label: "Fit" },
  { key: "status", label: "Status" },
  { key: "source", label: "Lead source" },
];
const COLUMNS_KEY = "founder.manualOutreach.columns";
const NUDGE_SNOOZE_KEY = "founder.manualOutreach.nudgeSnoozeUntil";
const NUDGE_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
const STATUS_OPTIONS = ["Not contacted", "Queued", "Sent", "Opened", "Clicked", "Replied", "Stopped", "Skipped"];

function fitBand(fit: number | null): string {
  if (fit === null) return "Not scored";
  if (fit >= 75) return "Strong fit (75 or more)";
  if (fit >= 45) return "Good fit (45 to 74)";
  return "Lower fit (under 45)";
}
function typeTokens(v: string | null): string[] {
  return (v ?? "").split(/[,;]/).map((x) => x.trim()).filter(Boolean);
}

function Banner({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p className={`mt-3 rounded-lg px-3 py-2 text-[12.5px] ${msg.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>
  );
}

export function LaunchManualOutreach({ contacts, directoryDefaults }: { contacts: OutreachAudienceContact[]; directoryDefaults?: DirectoryDefaults }) {
  // "Import my matches" only shows when the company profile has something to match on.
  const canMatch = !!(directoryDefaults?.industry || directoryDefaults?.fundingStage || directoryDefaults?.investorTypes);
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
  // Remind me later on the launch nudge. Read after mount so the first render matches the server.
  const [nudgeSnoozed, setNudgeSnoozed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      try { setNudgeSnoozed(Number(localStorage.getItem(NUDGE_SNOOZE_KEY)) > Date.now()); } catch { /* storage unavailable */ }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const snoozeNudge = () => {
    try { localStorage.setItem(NUDGE_SNOOZE_KEY, String(Date.now() + NUDGE_SNOOZE_MS)); } catch { /* storage unavailable */ }
    setNudgeSnoozed(true);
  };

  // ---- UI ----
  const [view, setView] = useState<"home" | "wizard">("home");
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [sort, setSort] = useState<{ key: ColKey | ""; dir: 1 | -1 }>({ key: "", dir: 1 });
  const [shown, setShown] = useState<Record<ColKey, boolean>>({ contact: true, email: true, type: true, sectors: true, fit: true, status: true, source: true });
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [matchesOpen, setMatchesOpen] = useState(false);
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

  // Remember which columns the founder turned off, in this browser.
  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const raw = window.localStorage.getItem(COLUMNS_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<Record<ColKey, boolean>>;
        setShown((prev) => {
          const next = { ...prev };
          for (const c of COLUMNS) if (typeof saved[c.key] === "boolean") next[c.key] = saved[c.key] as boolean;
          next.contact = true;
          return next;
        });
      } catch {
        /* storage blocked: all columns stay on */
      }
    });
  }, []);

  function saveShown(next: Record<ColKey, boolean>) {
    setShown(next);
    try {
      window.localStorage.setItem(COLUMNS_KEY, JSON.stringify(next));
    } catch {
      /* not remembered, still works */
    }
  }

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

  const fitCo = useMemo(() => fitCompany(directoryDefaults), [directoryDefaults]);
  const fitById = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const c of contactList) m.set(c.id, contactFit({ id: c.id, investorType: c.investorType, sectors: c.sectors, stages: c.stages, geography: c.geography }, fitCo));
    return m;
  }, [contactList, fitCo]);
  const fitOf = useCallback((c: OutreachContact) => fitById.get(c.id) ?? null, [fitById]);

  const filtered = useMemo(
    () =>
      applySearch(contactList, search, {
        text: (c) => [c.name, c.firm ?? "", c.email ?? "", c.investorType ?? "", c.sectors ?? "", c.source].join(" "),
        quick: {
          has_email: (c) => !!c.email,
          no_email: (c) => !c.email,
          not_contacted: (c) => outreachLabel(c) === "Not contacted",
          clicked: (c) => outreachLabel(c) === "Clicked",
          strong: (c) => (fitOf(c) ?? -1) >= 75,
        },
        field: {
          source: (c) => c.source,
          outreach: (c) => outreachLabel(c),
          type: (c) => typeTokens(c.investorType),
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contactList, search, statusByEmail, fitOf],
  );

  const ordered = useMemo(() => {
    const byName = (a: OutreachContact, b: OutreachContact) => a.name.localeCompare(b.name);
    const text = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
    const rows = [...filtered];
    if (!sort.key) {
      // Default: your own contacts first, then the directory, best fit first inside each.
      return rows.sort((a, b) => SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source) || (fitOf(b) ?? -1) - (fitOf(a) ?? -1) || byName(a, b));
    }
    const pick = (c: OutreachContact): string | number | null => {
      switch (sort.key) {
        case "contact": return text(c.name);
        case "email": return c.email ? text(c.email) : null;
        case "type": return text(c.investorType) || null;
        case "sectors": return text(c.sectors) || null;
        case "fit": return fitOf(c);
        case "status": return outreachLabel(c).toLowerCase();
        default: return text(c.source);
      }
    };
    return rows.sort((a, b) => {
      const x = pick(a);
      const y = pick(b);
      // Empty values always sit at the bottom, whichever way it sorts.
      if (x === null && y === null) return byName(a, b);
      if (x === null) return 1;
      if (y === null) return -1;
      const d = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return d * sort.dir || byName(a, b);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sort, fitOf, statusByEmail]);

  const grouped = useMemo(() => {
    const g = groupRows(ordered, search.groupBy, "none", {
      source: (c) => c.source,
      outreach: (c) => outreachLabel(c),
      fit: (c) => fitBand(fitOf(c)),
    });
    if (search.groupBy === "source") g.sort((a, b) => SOURCE_ORDER.indexOf(a.label) - SOURCE_ORDER.indexOf(b.label));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered, search.groupBy, fitOf, statusByEmail]);

  const shownCols = COLUMNS.filter((c) => shown[c.key]);
  const q = search.q.trim();
  const gearItems: GearItem[] = [
    { key: "add-one", icon: "ti-user-plus", label: "Add one contact", section: "Actions", onClick: () => setAddOpen(true) },
    { key: "add-file", icon: "ti-file-import", label: "Import a file", onClick: () => setImportOpen(true) },
    { key: "add-dir", icon: "ti-users-plus", label: "Import from Investor directory", onClick: () => setDirectoryOpen(true) },
    { key: "dir", icon: "ti-world-search", label: "Import in the Investor directory", href: "/founder/investor-directory" },
    ...COLUMNS.map((c, i): GearItem => ({
      key: `col-${c.key}`,
      icon: "ti-columns",
      label: c.label,
      hint: c.key === "contact" ? "Always on" : undefined,
      active: shown[c.key],
      keepOpen: true,
      section: i === 0 ? "Columns" : undefined,
      sep: i === 0,
      onClick: () => {
        if (c.key !== "contact") saveShown({ ...shown, [c.key]: !shown[c.key] });
      },
    })),
    {
      key: "col-all",
      icon: "ti-eye",
      label: "Show all columns",
      keepOpen: true,
      sep: true,
      onClick: () => saveShown({ contact: true, email: true, type: true, sectors: true, fit: true, status: true, source: true }),
    },
  ];

  function sortBy(key: ColKey) {
    setSort((s) => (s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : { key: "", dir: 1 }));
  }

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
      {recipients.length === 0 && nudgeSnoozed ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-sm text-slate-600">Your campaign has not started. The reminder returns in 3 days.</p>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Snoozed 3 days</span>
          <button
            type="button"
            onClick={openWizard}
            disabled={capReached}
            title={capReached ? `Email limit reached. Sending resumes ${emailCap?.resetsLabel}.` : undefined}
            className={`${btnPrimary} ml-auto`}
          >
            Launch the wizard
          </button>
        </div>
      ) : recipients.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900">Launch your manual outreach</p>
            <p className="text-[13px] text-amber-800">
              You have not sent your first email yet. The wizard takes you through five short steps: investors, message, attachments, follow ups, then review and send. Nothing goes out until you start the campaign.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center sm:gap-4">
            <button
              type="button"
              onClick={openWizard}
              disabled={capReached}
              title={capReached ? `Email limit reached. Sending resumes ${emailCap?.resetsLabel}.` : undefined}
              className={`${btnPrimary} w-full sm:w-auto`}
            >
              Launch the wizard
            </button>
            <button type="button" onClick={snoozeNudge} className="text-center text-xs text-amber-800 underline">
              Remind me later
            </button>
          </div>
        </div>
      ) : (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-600">
          {`Your campaign is ${status === "queued" ? "running" : "saved"}. Next send window: ${nextSendWindow()}.`}
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
      )}
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
        <ToolbarGear items={gearItems} />
        <div className="min-w-[220px] flex-1">
          <OdooSearchBar
            scope="manual_outreach_investors"
            state={search}
            onChange={setSearch}
            api="/api/founder/saved-views"
            personalOnly
            width="100%"
            placeholder="Search name, firm, email, sector"
            quick={[
              { key: "has_email", label: "Has an email" },
              { key: "no_email", label: "No email" },
              { key: "not_contacted", label: "Not contacted yet" },
              { key: "clicked", label: "Clicked" },
              { key: "strong", label: "Fit 75 or more" },
            ]}
            fields={[
              { key: "source", label: "Lead source", options: SOURCE_ORDER },
              { key: "outreach", label: "Status", options: STATUS_OPTIONS },
              { key: "type", label: "Type", options: [...new Set(contactList.flatMap((c) => typeTokens(c.investorType)))].sort() },
            ]}
            groups={[
              { id: "none", label: "None" },
              { id: "source", label: "Lead source" },
              { id: "outreach", label: "Status" },
              { id: "fit", label: "Fit band" },
            ]}
            noGroupId="none"
          />
        </div>
        <span className="whitespace-nowrap text-xs text-slate-500" aria-live="polite">
          {filtered.length} of {contactList.length} contacts
        </span>
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
        {canMatch ? (
          <button type="button" className="rounded-lg border-2 border-[#1A6CE4] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#1A6CE4] hover:bg-blue-50" onClick={() => setMatchesOpen(true)}>
            Import my matches
          </button>
        ) : null}
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
      </div>
      {contactList.length === 0 ? <p className="mt-4 text-sm text-slate-500">No investors yet. Add one above or import them in the Investor directory.</p> : null}
      {contactList.length > 0 && filtered.length === 0 ? <p className="mt-4 text-sm text-slate-500">No contacts match this search.</p> : null}
      {filtered.length > 0 ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th className="w-7 px-1 py-2" />
                {shownCols.map((c) => {
                  const on = sort.key === c.key;
                  return (
                    <th key={c.key} className="px-1.5 py-2" aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                      <button type="button" onClick={() => sortBy(c.key)} className={`inline-flex items-center gap-1 font-bold uppercase tracking-wide hover:text-slate-900 ${on ? "text-[#1A6CE4]" : ""}`}>
                        {c.label}
                        <i className={`ti ${on ? (sort.dir === 1 ? "ti-arrow-up" : "ti-arrow-down") : "ti-arrows-sort"} text-[13px] ${on ? "" : "text-slate-300"}`} aria-hidden="true" />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => (
                <Fragment key={g.label || "all"}>
                  {g.label ? (
                    <tr>
                      <td colSpan={shownCols.length + 1} className="px-1 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        {g.label}
                      </td>
                    </tr>
                  ) : null}
                  {g.rows.map((c) => {
                    const fit = fitOf(c);
                    return (
                      <tr key={c.id} className="cursor-pointer border-b border-slate-100 align-top hover:bg-slate-50" onClick={() => toggle(c.id)}>
                        <td className="px-1 py-2">
                          <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${c.name}`} />
                        </td>
                        {shown.contact ? (
                          <td className="px-1.5 py-2">
                            <span className="font-medium text-slate-900"><Highlight text={c.name} query={q} /></span>
                            {c.firm ? <span className="text-slate-500"> at <Highlight text={c.firm} query={q} /></span> : null}
                          </td>
                        ) : null}
                        {shown.email ? (
                          <td className="px-1.5 py-2 text-[12px]">
                            {c.email ? <span className="text-slate-600"><Highlight text={c.email} query={q} /></span> : <span className="text-amber-700">no email, will be skipped</span>}
                          </td>
                        ) : null}
                        {shown.type ? <td className="px-1.5 py-2 text-[12px] text-slate-600">{c.investorType ? <Highlight text={c.investorType} query={q} /> : "none"}</td> : null}
                        {shown.sectors ? <td className="px-1.5 py-2 text-[12px] text-slate-600">{c.sectors ? <Highlight text={c.sectors} query={q} /> : "none"}</td> : null}
                        {shown.fit ? (
                          <td className="whitespace-nowrap px-1.5 py-2">
                            {fit === null ? (
                              <span className="text-[12px] text-slate-500">Not scored</span>
                            ) : (
                              <>
                                <span className={`font-bold ${fit >= 75 ? "text-emerald-600" : fit >= 45 ? "text-[#1A6CE4]" : "text-slate-500"}`}>{fit}</span>
                                <span className="text-[12px] text-slate-500"> / 100</span>
                              </>
                            )}
                          </td>
                        ) : null}
                        {shown.status ? (
                          <td className="px-1.5 py-2">
                            <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{outreachLabel(c)}</span>
                          </td>
                        ) : null}
                        {shown.source ? <td className="px-1.5 py-2 text-[12px] text-slate-600"><Highlight text={c.source} query={q} /></td> : null}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
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
      {matchesOpen ? (
        <MatchFromDirectoryWizard
          defaults={directoryDefaults}
          onClose={() => setMatchesOpen(false)}
          onImported={() => {
            setMatchesOpen(false);
            void reloadAndSelectNew("Matched investors imported to My contacts and added to this wave.");
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
