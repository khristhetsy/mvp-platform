"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OdooPager } from "@/components/admin/OdooPager";
import { useDismiss } from "@/lib/ui/use-dismiss";
import { contactSourceLabel, contactStatusLabel } from "@/lib/founder-crm/contact-labels";
import type { FounderInvestorContactRecord } from "@/lib/founder-crm/types";
import type { ManualRecipientStatus } from "@/lib/outreach/manual-outreach";

/**
 * Stage 3 → My contacts → one contact. Modeled on the Admin contact page:
 * header with actions, summary tiles, Details, then tabs.
 *
 * Step 1 ships Investor profile (read and edit, with the same option lists the
 * rest of iCapOS uses), Activity (from Manual outreach), and Archive. Send
 * email, Note log and Tasks are shown as coming next and are not clickable.
 */

type Options = {
  investorTypes: string[];
  stages: string[];
  sectors: string[];
  geography: string[];
  operatingStages: string[];
  useOfFunds: string[];
  moneyBands: string[];
  revenueBands: string[];
  arrBands: string[];
  mrrBands: string[];
};

type Pager = { index: number; total: number; prevId: string | null; nextId: string | null };

/**
 * The Investor profile follows the Admin contact page model: sections of rows,
 * click a value to edit it, and a bar that counts unsaved changes.
 *
 * "col" fields live in their own column on founder_investor_contacts. "profile"
 * fields live in the investor_profile JSON column (one key per field). Multi
 * values are stored comma separated, as the directory import already writes them.
 */
type Kind = "text" | "textarea" | "select" | "multi" | "link" | "email";
type FieldDef = {
  key: string;
  label: string;
  kind: Kind;
  store: "col" | "profile";
  options?: (o: Options) => string[];
  /** Cannot be blank (a contact needs a name). */
  required?: boolean;
};
type SectionDef = { title: string; fields: FieldDef[] };

// The Admin Industry choices for an investor.
const ADMIN_INDUSTRIES = [
  "Biotechnology/Life Science",
  "Health & Wellness",
  "Healthcare",
  "Medical Devices",
  "Nano Technology",
  "Real Estate",
];

// Admin builds this list from synced Odoo answers. Until the exact list is confirmed, these are the working choices.
const DEALS_PER_YEAR = ["1 to 2", "3 to 5", "6 to 10", "More than 10"];

const SECTIONS: SectionDef[] = [
  {
    title: "Investor information",
    fields: [
      { key: "investor_name", label: "Full name", kind: "text", store: "col", required: true },
      { key: "firm_name", label: "Firm", kind: "text", store: "col" },
      { key: "email", label: "Email", kind: "email", store: "col" },
      { key: "phone", label: "Phone", kind: "text", store: "col" },
      { key: "investor_type", label: "Investor type", kind: "select", store: "col", options: (o) => o.investorTypes },
      { key: "business_summary", label: "Investor business summary", kind: "textarea", store: "profile" },
    ],
  },
  {
    title: "Investor thesis",
    fields: [
      { key: "industry", label: "Industry", kind: "multi", store: "profile", options: () => ADMIN_INDUSTRIES },
      { key: "operating_stage", label: "Operating stage", kind: "multi", store: "profile", options: (o) => o.operatingStages },
      { key: "investment_size", label: "Investment size", kind: "select", store: "profile", options: (o) => o.moneyBands },
      { key: "use_of_funds", label: "Use of funds", kind: "multi", store: "profile", options: (o) => o.useOfFunds },
      { key: "deals_per_year", label: "Deals per year", kind: "select", store: "profile", options: () => DEALS_PER_YEAR },
      { key: "revenue_range", label: "Annual revenue range", kind: "select", store: "profile", options: (o) => o.revenueBands },
      { key: "ebitda_range", label: "Annual EBITDA range", kind: "select", store: "profile", options: (o) => o.moneyBands },
      { key: "arr_range", label: "Preferred ARR range", kind: "select", store: "profile", options: (o) => o.arrBands },
      { key: "mrr_range", label: "Preferred MRR range", kind: "select", store: "profile", options: (o) => o.mrrBands },
      { key: "management_team", label: "Management team", kind: "textarea", store: "profile" },
    ],
  },
  {
    title: "Focus from your list (iCapOS additions)",
    fields: [
      { key: "preferred_stages", label: "Stages", kind: "multi", store: "col", options: (o) => o.stages },
      { key: "preferred_sectors", label: "Sectors", kind: "multi", store: "col", options: (o) => o.sectors },
      { key: "check_size_min", label: "Check size min", kind: "select", store: "profile", options: (o) => o.moneyBands },
      { key: "check_size_max", label: "Check size max", kind: "select", store: "profile", options: (o) => o.moneyBands },
      { key: "geography", label: "Geography", kind: "select", store: "col", options: (o) => o.geography },
    ],
  },
  {
    title: "About me",
    fields: [
      { key: "short_bio", label: "Short bio", kind: "textarea", store: "profile" },
      { key: "special_skills", label: "Special skills", kind: "textarea", store: "profile" },
      { key: "work_experience", label: "Work experience", kind: "textarea", store: "profile" },
    ],
  },
  {
    title: "Social",
    fields: [
      { key: "website", label: "Website", kind: "link", store: "col" },
      { key: "linkedin_url", label: "LinkedIn", kind: "link", store: "col" },
      { key: "angellist_url", label: "AngelList", kind: "link", store: "profile" },
      { key: "facebook_url", label: "Facebook", kind: "link", store: "profile" },
      { key: "twitter_url", label: "Twitter / X", kind: "link", store: "col" },
      { key: "instagram_url", label: "Instagram", kind: "link", store: "profile" },
      { key: "crunchbase_url", label: "Crunchbase", kind: "link", store: "col" },
      { key: "personal_website_url", label: "Personal website", kind: "link", store: "col" },
      { key: "other_social_url", label: "Other", kind: "link", store: "col" },
    ],
  },
  {
    title: "Your notes (internal)",
    fields: [
      { key: "notes", label: "Note", kind: "textarea", store: "col" },
      { key: "quick_notes", label: "Quick notes", kind: "textarea", store: "profile" },
    ],
  },
];
const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);

type Values = Record<string, string>;

function money(n: number | null | undefined): string {
  return n == null ? "" : `$${n.toLocaleString("en-US")}`;
}

/** Every field's current stored value as a string, keyed by field key. */
function toValues(c: FounderInvestorContactRecord): Values {
  const rec = c as unknown as Record<string, unknown>;
  const profile = (c.investor_profile ?? {}) as Record<string, string>;
  const out: Values = {};
  for (const f of ALL_FIELDS) {
    if (f.store === "col") {
      const v = rec[f.key];
      out[f.key] = typeof v === "string" ? v : "";
    } else {
      out[f.key] = typeof profile[f.key] === "string" ? profile[f.key] : "";
    }
  }
  // Check sizes saved before the bands existed were exact amounts. Show them until a band is picked.
  if (!out.check_size_min) out.check_size_min = money(c.check_size_min);
  if (!out.check_size_max) out.check_size_max = money(c.check_size_max);
  return out;
}

const TABS = [
  { id: "email", label: "Send email", soon: true },
  { id: "note", label: "Note log", soon: true },
  { id: "profile", label: "Investor profile", soon: false },
  { id: "tasks", label: "Tasks", soon: true },
  { id: "activity", label: "Activity", soon: false },
] as const;
type TabId = (typeof TABS)[number]["id"];

const inputCls = "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-800";
const btn = "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50";

function splitList(v: string | null | undefined): string[] {
  return (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
}

function day(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

function stageOf(r: ManualRecipientStatus | null): string {
  if (!r) return "Not contacted";
  if (r.repliedAt) return "Replied";
  if (r.clickedAt) return "Clicked";
  if (r.openedAt) return "Opened";
  if (r.status === "skipped") return "Skipped";
  if (r.status === "stopped") return "Stopped";
  if (r.sentAt) return "Sent";
  return "Queued";
}

function Row({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)] sm:grid-cols-[230px_minmax(0,1fr)] items-center gap-x-3 border-b border-slate-100 py-1.5 text-[13px]">
      <span className="text-slate-500">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Empty({ value }: Readonly<{ value: string | null | undefined }>) {
  return value ? <span className="break-words">{value}</span> : <span className="text-slate-300">—</span>;
}

function Link2({ value }: Readonly<{ value: string | null | undefined }>) {
  if (!value) return <span className="text-slate-300">—</span>;
  return (
    <a href={value} target="_blank" rel="noopener noreferrer" className="break-all text-[#1A6CE4] hover:underline">
      {value}
    </a>
  );
}

function SectionHead({ children }: Readonly<{ children: React.ReactNode }>) {
  return <p className="mb-1 mt-5 border-b border-slate-100 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-indigo-700 first:mt-0">{children}</p>;
}

function FieldRow({
  def,
  value,
  changed,
  editing,
  options,
  onOpen,
  onClose,
  onChange,
}: Readonly<{
  def: FieldDef;
  value: string;
  changed: boolean;
  editing: boolean;
  options: string[];
  onOpen: () => void;
  onClose: () => void;
  onChange: (v: string) => void;
}>) {
  const marker = changed ? <span className="ml-2 text-[10.5px] text-amber-600">edited</span> : null;
  if (!editing) {
    const shown = def.kind === "multi" ? splitList(value).join(", ") : value;
    return (
      <Row label={def.label}>
        <button
          type="button"
          onClick={onOpen}
          title="Click to edit"
          className="block w-full min-w-0 cursor-pointer break-words border-b border-dashed border-transparent text-left hover:border-slate-300"
        >
          {shown ? (
            <span className={def.kind === "link" ? "text-[#1A6CE4]" : "whitespace-pre-wrap"}>{shown}</span>
          ) : (
            <span className="text-slate-300">—</span>
          )}
          {marker}
        </button>
      </Row>
    );
  }
  const done = (
    <button type="button" onClick={onClose} className="ml-2 shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[12px] text-slate-600 hover:bg-slate-50">Done</button>
  );
  if (def.kind === "multi") {
    return (
      <Row label={def.label}>
        <div className="flex items-start gap-1">
          <ChipPicker label={def.label} all={options} value={splitList(value)} onChange={(v) => onChange(v.join(", "))} />
          {done}
        </div>
      </Row>
    );
  }
  if (def.kind === "select") {
    const menu = [...options, ...(value && !options.includes(value) ? [value] : [])];
    return (
      <Row label={def.label}>
        <div className="flex items-center">
          <select aria-label={def.label} autoFocus className={`${inputCls} max-w-xs`} value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">Not set</option>
            {menu.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          {done}
        </div>
      </Row>
    );
  }
  if (def.kind === "textarea") {
    return (
      <Row label={def.label}>
        <div className="flex items-start">
          <textarea aria-label={def.label} autoFocus rows={3} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} />
          {done}
        </div>
      </Row>
    );
  }
  return (
    <Row label={def.label}>
      <div className="flex items-center">
        <input
          aria-label={def.label}
          autoFocus
          type={def.kind === "email" ? "email" : "text"}
          placeholder={def.kind === "link" ? "https://" : undefined}
          className={inputCls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {done}
      </div>
    </Row>
  );
}

export function ContactDetailClient({
  initialContact,
  pager,
  engagement,
  options,
}: Readonly<{
  initialContact: FounderInvestorContactRecord;
  pager: Pager;
  engagement: ManualRecipientStatus | null;
  options: Options;
}>) {
  const router = useRouter();
  const [contact, setContact] = useState(initialContact);
  const [tab, setTab] = useState<TabId>("profile");
  const [orig, setOrig] = useState<Values>(() => toValues(initialContact));
  const [draft, setDraft] = useState<Values>(() => toValues(initialContact));
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuRef = useDismiss(menuOpen, closeMenu);

  const source = contactSourceLabel(contact.source);
  const initials = contact.investor_name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  const stage = stageOf(engagement);
  const sentOn = day(engagement?.sentAt);
  const lastActivity = day(engagement?.repliedAt ?? engagement?.clickedAt ?? engagement?.openedAt ?? engagement?.sentAt);

  const changedKeys = ALL_FIELDS.filter((f) => (draft[f.key] ?? "") !== (orig[f.key] ?? "")).map((f) => f.key);

  function setField(key: string, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function undoAll() {
    setDraft({ ...orig });
    setEditingKey(null);
    setMessage(null);
  }

  function openProfile() {
    setMessage(null);
    setTab("profile");
    setMenuOpen(false);
  }

  async function save() {
    if (changedKeys.length === 0) return;
    if (changedKeys.includes("investor_name") && !(draft.investor_name ?? "").trim()) {
      setMessage({ tone: "error", text: "A contact needs a name." });
      return;
    }
    setSaving(true);
    setMessage(null);
    const body: Record<string, unknown> = {};
    const profileKeys = changedKeys.filter((k) => ALL_FIELDS.find((f) => f.key === k)?.store === "profile");
    for (const k of changedKeys) {
      const def = ALL_FIELDS.find((f) => f.key === k);
      if (def?.store === "col") body[k] = (draft[k] ?? "").trim();
    }
    if (profileKeys.length > 0) {
      // Send the whole object so nothing already stored is lost.
      const next: Record<string, string> = { ...((contact.investor_profile ?? {}) as Record<string, string>) };
      for (const k of profileKeys) next[k] = (draft[k] ?? "").trim();
      body.investor_profile = next;
    }
    try {
      const res = await fetch(`/api/founder/investor-contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { contact?: FounderInvestorContactRecord; error?: string } | null;
      if (!res.ok || !data?.contact) {
        setMessage({ tone: "error", text: "Couldn't save. Check the email address and the links (they need https://), then try again." });
        return;
      }
      setContact(data.contact);
      const fresh = toValues(data.contact);
      setOrig(fresh);
      setDraft(fresh);
      setEditingKey(null);
      setMessage({ tone: "ok", text: "Saved." });
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: "Network error. Try again." });
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/founder/investor-contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: true }),
      });
      if (!res.ok) {
        setMessage({ tone: "error", text: "Couldn't archive this contact." });
        setConfirmArchive(false);
        return;
      }
      router.push("/founder/contacts");
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: "Network error. Try again." });
      setConfirmArchive(false);
    } finally {
      setSaving(false);
    }
  }

  const activity: { when: string; text: string }[] = [];
  activity.push({ when: contact.created_at, text: `Added to My contacts (${source})` });
  if (engagement?.sentAt) activity.push({ when: engagement.sentAt, text: "Email sent" });
  if (engagement?.openedAt) activity.push({ when: engagement.openedAt, text: "Opened your email" });
  if (engagement?.clickedAt) activity.push({ when: engagement.clickedAt, text: "Clicked a link" });
  if (engagement?.repliedAt) activity.push({ when: engagement.repliedAt, text: "Replied" });
  activity.sort((a, b) => Date.parse(b.when) - Date.parse(a.when));

  return (
    <div className="space-y-3">
      {/* Breadcrumb and pager */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-slate-500">
        <p>
          <Link href="/founder/contacts" className="hover:text-slate-800 hover:underline">← My contacts</Link>
          <span className="mx-1.5">/</span>
          <span className="text-slate-700">{contact.investor_name}</span>
        </p>
        <OdooPager
          label={`${pager.index} / ${pager.total}`}
          prev={pager.prevId ? { href: `/founder/contacts/${pager.prevId}` } : { disabled: true }}
          next={pager.nextId ? { href: `/founder/contacts/${pager.nextId}` } : { disabled: true }}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-[#185FA5]" aria-hidden="true">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-semibold text-slate-950">{contact.investor_name}</h1>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#185FA5]">{contactStatusLabel(contact.status)}</span>
              </div>
              {contact.firm_name ? <p className="mt-0.5 text-[13px] text-slate-500">{contact.firm_name}</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {contact.phone ? <a href={`tel:${contact.phone}`} className="rounded-lg bg-emerald-800 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-emerald-900">Call</a> : null}
            {contact.email ? <a href={`mailto:${contact.email}`} className={btn}>Email</a> : null}
            <Link href="/founder/deploy" className={btn}>Add to outreach</Link>
            <div ref={menuRef} className="relative">
              <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} className={btn}>
                Actions <i className="ti ti-chevron-down" aria-hidden="true" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-[calc(100%+5px)] z-40 min-w-[190px] rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
                  <button type="button" onClick={openProfile} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12.5px] text-slate-700 hover:bg-slate-50">
                    <i className="ti ti-pencil text-base text-slate-500" aria-hidden="true" /> Edit profile
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setConfirmArchive(true); }}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12.5px] text-slate-700 hover:bg-slate-50"
                  >
                    <i className="ti ti-archive text-base text-slate-500" aria-hidden="true" /> Archive
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {confirmArchive ? (
          <div className="mx-6 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[12.5px] text-slate-700">
            <span className="max-w-3xl">
              <strong>Archive {contact.investor_name}?</strong> The contact leaves My contacts and Manual outreach. Its history is kept,
              and it stops counting toward your investor limit.
            </span>
            <span className="flex gap-2">
              <button type="button" onClick={() => setConfirmArchive(false)} className={btn} disabled={saving}>Cancel</button>
              <button type="button" onClick={() => void archive()} disabled={saving} className="cap-btn-primary rounded-lg px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-50">
                {saving ? "Archiving…" : "Archive contact"}
              </button>
            </span>
          </div>
        ) : null}

        {message && tab !== "profile" ? (
          <p className={`mx-6 mb-3 text-[12px] ${message.tone === "ok" ? "text-emerald-700" : "text-red-600"}`} role="status">{message.text}</p>
        ) : null}

        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-3 px-6 pb-5 md:grid-cols-4">
          {[
            ["Outreach status", stage],
            ["Email sent", sentOn || "Not yet"],
            ["Opened / clicked", `${engagement?.openedAt ? "Yes" : "No"} / ${engagement?.clickedAt ? "Yes" : "No"}`],
            ["Last activity", lastActivity || "—"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-50 px-3.5 py-3">
              <p className="text-[12px] text-slate-500">{label}</p>
              <p className="mt-1.5 text-[17px] font-semibold text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        {/* Details */}
        <div className="border-t border-slate-100 px-6">
          <span className="inline-block border-b-2 border-[#185FA5] py-3 text-[13px] font-semibold text-slate-900">Details</span>
        </div>
        <div className="grid gap-x-12 px-6 pb-5 pt-1 md:grid-cols-2">
          <div>
            <Row label="Investor type"><Empty value={contact.investor_type} /></Row>
            <Row label="Stages"><Empty value={contact.preferred_stages} /></Row>
            <Row label="Sectors"><Empty value={contact.preferred_sectors} /></Row>
            <Row label="Source">{source}</Row>
            {source === "From investor directory" ? <Row label="Verified">Not yet verified by iCFO</Row> : null}
            <Row label="Added on">{day(contact.created_at)}</Row>
          </div>
          <div>
            <Row label="Firm"><Empty value={contact.firm_name} /></Row>
            <Row label="Email">{contact.email ? <a href={`mailto:${contact.email}`} className="text-[#1A6CE4] hover:underline">{contact.email}</a> : <Empty value={null} />}</Row>
            <Row label="Phone"><Empty value={contact.phone} /></Row>
            <Row label="Website"><Link2 value={contact.website} /></Row>
            <Row label="Location"><Empty value={contact.geography} /></Row>
            <Row label="Tags">{contact.tags?.length ? contact.tags.join(", ") : <Empty value={null} />}</Row>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-5 border-t border-slate-100 px-6" role="tablist">
          {TABS.map((t) =>
            t.soon ? (
              <span key={t.id} className="py-3 text-[13px] text-slate-300" title="Coming next">
                {t.label} <span className="rounded bg-slate-100 px-1 text-[10px] text-slate-400">soon</span>
              </span>
            ) : (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`border-b-2 py-3 text-[13px] ${tab === t.id ? "border-[#185FA5] font-semibold text-[#185FA5]" : "border-transparent text-slate-700 hover:text-slate-900"}`}
              >
                {t.label}
              </button>
            ),
          )}
        </div>

        <div className="min-h-[260px] px-6 pb-7 pt-4">
          {tab === "profile" ? (
            <div>
              <p className="mb-1 text-[12px] text-slate-500">Click any value to edit it.</p>
              {SECTIONS.map((sec) => (
                <div key={sec.title}>
                  <SectionHead>{sec.title}</SectionHead>
                  {sec.fields.map((f) => (
                    <FieldRow
                      key={f.key}
                      def={f}
                      value={draft[f.key] ?? ""}
                      changed={(draft[f.key] ?? "") !== (orig[f.key] ?? "")}
                      editing={editingKey === f.key}
                      options={f.options ? f.options(options) : []}
                      onOpen={() => setEditingKey(f.key)}
                      onClose={() => setEditingKey(null)}
                      onChange={(v) => setField(f.key, v)}
                    />
                  ))}
                  {sec.title === "Investor information" ? (
                    <Row label="Added on"><span className="text-slate-700">{day(contact.created_at)}</span></Row>
                  ) : null}
                </div>
              ))}
              {message ? <p className={`mt-3 text-[12px] ${message.tone === "ok" ? "text-emerald-700" : "text-red-600"}`} role="status">{message.text}</p> : null}
              {changedKeys.length > 0 ? (
                <div className="mt-4 flex items-center gap-2.5 border-t border-slate-100 pt-3">
                  <span className="text-[12px] text-slate-500">{changedKeys.length} unsaved change{changedKeys.length === 1 ? "" : "s"}</span>
                  <span className="ml-auto" />
                  <button type="button" onClick={undoAll} disabled={saving} className={btn}>Undo all</button>
                  <button type="button" onClick={() => void save()} disabled={saving} className="cap-btn-primary rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold disabled:opacity-50">
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              ) : null}
              <p className="mt-3 text-[12px] text-slate-500">Directory contacts keep the line: not the iCFO Capital investor network.</p>
            </div>
          ) : null}

          {tab === "activity" ? (
            <ul className="space-y-2">
              {activity.map((a) => (
                <li key={`${a.when}-${a.text}`} className="flex items-baseline gap-3 border-b border-slate-100 pb-2 text-[13px]">
                  <span className="w-24 shrink-0 tabular-nums text-slate-400">{day(a.when)}</span>
                  <span className="text-slate-700">{a.text}</span>
                </li>
              ))}
              {!engagement ? <li className="pt-1 text-[12.5px] text-slate-400">No emails sent to this contact yet.</li> : null}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ChipPicker({
  label,
  all,
  value,
  onChange,
}: Readonly<{ label: string; all: string[]; value: string[]; onChange: (v: string[]) => void }>) {
  // Keep any value the contact already holds, even if it is no longer on the menu.
  const menu = [...all, ...value.filter((v) => !all.includes(v))];
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {menu.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={`rounded-full border px-3 py-1 text-[12.5px] ${on ? "border-[#185FA5] bg-blue-50 text-[#185FA5]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
