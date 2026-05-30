"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { OutreachReadinessResult } from "@/lib/founder-crm/outreach-readiness";
import type {
  FounderInvestorContactRecord,
  OutreachCampaignRecord,
} from "@/lib/founder-crm/types";

type PlatformMatch = {
  platformInvestorId: string;
  matchScore: number;
  matchReasons: string[];
  label: string;
};

type Props = {
  companyName: string;
  contacts: FounderInvestorContactRecord[];
  targets: Array<{
    id: string;
    status: string;
    source: string;
    match_score: number | null;
    next_follow_up_at: string | null;
  }>;
  campaigns: OutreachCampaignRecord[];
  readiness: OutreachReadinessResult;
  platformMatches: PlatformMatch[];
  followUpCount: number;
};

const CONTACT_STATUSES = [
  "new",
  "researching",
  "selected",
  "contacted",
  "responded",
  "meeting_scheduled",
  "not_interested",
] as const;

export function FounderInvestorHubPanels({
  companyName,
  contacts: initialContacts,
  targets,
  campaigns: initialCampaigns,
  readiness,
  platformMatches,
  followUpCount,
}: Readonly<Props>) {
  const router = useRouter();
  const [contacts, setContacts] = useState(initialContacts);
  const [campaigns] = useState(initialCampaigns);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importPreview, setImportPreview] = useState<Array<Record<string, unknown>> | null>(null);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        row.investor_name.toLowerCase().includes(q) ||
        (row.firm_name?.toLowerCase().includes(q) ?? false) ||
        (row.email?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [contacts, search, statusFilter]);

  async function addContact(formData: FormData) {
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/founder/investor-contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        investor_name: formData.get("investor_name"),
        firm_name: formData.get("firm_name") || undefined,
        email: formData.get("email") || undefined,
        investor_type: formData.get("investor_type") || undefined,
        preferred_sectors: formData.get("preferred_sectors") || undefined,
        preferred_stages: formData.get("preferred_stages") || undefined,
        geography: formData.get("geography") || undefined,
        notes: formData.get("notes") || undefined,
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      contact?: FounderInvestorContactRecord;
      error?: string;
    } | null;
    setLoading(false);
    if (!response.ok || !body?.contact) {
      setMessage(body?.error ?? "Unable to add contact.");
      return;
    }
    setContacts((rows) => [body.contact!, ...rows]);
    setMessage("Contact added.");
    router.refresh();
  }

  function parseCsvToRows(text: string) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      return [];
    }
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });
      return {
        investor_name: row.investor_name,
        firm_name: row.firm_name,
        email: row.email,
        investor_type: row.investor_type,
        sector: row.sector,
        stage: row.stage,
        check_size: row.check_size,
        geography: row.geography,
        website: row.website,
        notes: row.notes,
      };
    });
  }

  async function previewImport() {
    setLoading(true);
    setMessage(null);
    const rows = parseCsvToRows(csvText);
    const response = await fetch("/api/founder/investor-contacts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows, confirm: false }),
    });
    const body = (await response.json().catch(() => null)) as { preview?: Array<Record<string, unknown>>; error?: string };
    setLoading(false);
    if (!response.ok) {
      setMessage(body?.error ?? "Import preview failed.");
      return;
    }
    setImportPreview(body?.preview ?? []);
  }

  async function confirmImport() {
    setLoading(true);
    const rows = parseCsvToRows(csvText);
    const response = await fetch("/api/founder/investor-contacts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows, confirm: true }),
    });
    setLoading(false);
    if (!response.ok) {
      setMessage("Import failed.");
      return;
    }
    setImportPreview(null);
    setCsvText("");
    setMessage("Import completed.");
    router.refresh();
  }

  async function createCampaign() {
    if (!readiness.allowed) {
      setMessage("Complete outreach readiness requirements first.");
      return;
    }
    const selected = contacts.filter((row) => row.status === "selected").slice(0, 25);
    if (selected.length === 0) {
      setMessage("Mark contacts as selected to include in a campaign.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/founder/outreach/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${companyName} outreach ${new Date().toLocaleDateString("en-US")}`,
        contactIds: selected.map((row) => row.id),
        draftKind: "intro",
      }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string; complianceNotice?: string };
    setLoading(false);
    if (!response.ok) {
      setMessage(body?.error ?? "Unable to create campaign.");
      return;
    }
    setMessage(body?.complianceNotice ?? "Campaign drafted (no emails sent).");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Outreach readiness</h2>
        <p className="mt-1 text-sm text-slate-600">
          Controlled outreach only — max 25 messages per day, one active campaign, no external email sending yet.
        </p>
        <ul className="mt-4 space-y-2">
          {readiness.requirements.map((row) => (
            <li key={row.key} className="flex items-center gap-2 text-sm">
              <span className={row.met ? "text-emerald-600" : "text-amber-600"}>
                {row.met ? "✓" : "○"}
              </span>
              <span className={row.met ? "text-slate-700" : "text-slate-900"}>{row.label}</span>
            </li>
          ))}
        </ul>
        {!readiness.allowed && readiness.learningRecommendations.length > 0 ? (
          <ul className="mt-3 list-disc pl-5 text-sm text-slate-600">
            {readiness.learningRecommendations.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        ) : null}
        {followUpCount > 0 ? (
          <p className="mt-3 text-sm text-amber-800">{followUpCount} follow-up reminders due.</p>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Add investor contact</h2>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void addContact(new FormData(event.currentTarget));
            }}
          >
            <input name="investor_name" required placeholder="Investor name" className="rounded-lg border px-3 py-2 text-sm" />
            <input name="firm_name" placeholder="Firm" className="rounded-lg border px-3 py-2 text-sm" />
            <input name="email" type="email" placeholder="Email" className="rounded-lg border px-3 py-2 text-sm" />
            <input name="investor_type" placeholder="Investor type" className="rounded-lg border px-3 py-2 text-sm" />
            <input name="preferred_sectors" placeholder="Sectors" className="rounded-lg border px-3 py-2 text-sm" />
            <input name="preferred_stages" placeholder="Stages" className="rounded-lg border px-3 py-2 text-sm" />
            <input name="geography" placeholder="Geography" className="rounded-lg border px-3 py-2 text-sm" />
            <textarea name="notes" placeholder="Notes" rows={2} className="rounded-lg border px-3 py-2 text-sm" />
            <button type="submit" disabled={loading} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
              Add contact
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Import CSV</h2>
          <p className="mt-1 text-xs text-slate-500">
            Columns: investor_name, firm_name, email, investor_type, sector, stage, check_size, geography, website, notes
          </p>
          <textarea
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            rows={6}
            className="mt-3 w-full rounded-lg border px-3 py-2 font-mono text-xs"
            placeholder="investor_name,firm_name,email,..."
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={loading} onClick={() => void previewImport()} className="rounded-lg border px-3 py-1.5 text-sm">
              Preview import
            </button>
            {importPreview ? (
              <button type="button" disabled={loading} onClick={() => void confirmImport()} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white">
                Confirm import
              </button>
            ) : null}
          </div>
          {importPreview ? (
            <p className="mt-2 text-xs text-slate-600">{importPreview.length} rows parsed — duplicates will be skipped.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950">Private investor CRM ({filteredContacts.length})</h2>
          <div className="flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              className="rounded-lg border px-3 py-1.5 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border px-3 py-1.5 text-sm"
            >
              <option value="all">All statuses</option>
              {CONTACT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 divide-y divide-slate-100">
          {filteredContacts.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">No private contacts yet.</p>
          ) : (
            filteredContacts.map((row) => (
              <ContactRow
                key={row.id}
                row={row}
                disabled={loading}
                onUpdated={(contact) =>
                  setContacts((rows) => rows.map((item) => (item.id === contact.id ? contact : item)))
                }
                onArchived={(contactId) =>
                  setContacts((rows) => rows.filter((item) => item.id !== contactId))
                }
                onMessage={setMessage}
                onLoading={setLoading}
              />
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Outreach pipeline ({targets.length})</h2>
        <p className="mt-1 text-sm text-slate-600">Tracked outreach targets — separate from platform messaging threads.</p>
        <div className="mt-4 divide-y divide-slate-100">
          {targets.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">No pipeline targets yet. Select contacts or platform matches to track outreach.</p>
          ) : (
            targets.slice(0, 12).map((row) => (
              <div key={row.id} className="py-3 text-sm">
                <p className="font-medium text-slate-900">{row.status}</p>
                <p className="text-xs text-slate-500">
                  {row.source}
                  {row.match_score != null ? ` · ${row.match_score}% match` : ""}
                  {row.next_follow_up_at
                    ? ` · follow-up ${new Date(row.next_follow_up_at).toLocaleDateString("en-US")}`
                    : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Platform matched investors</h2>
        <p className="mt-1 text-sm text-slate-600">CapitalOS registered investors — separate from your private CRM.</p>
        <div className="mt-4 divide-y divide-slate-100">
          {platformMatches.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">No platform matches available yet.</p>
          ) : (
            platformMatches.map((row) => (
              <div key={row.platformInvestorId} className="py-3 text-sm">
                <p className="font-medium text-slate-900">
                  {row.label} · {row.matchScore}% match
                </p>
                <p className="mt-1 text-xs text-slate-600">{row.matchReasons.slice(0, 2).join(" · ")}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Outreach campaigns (draft / queue only)</h2>
        <p className="mt-1 text-xs text-amber-800">
          Compliance: review every draft. Queueing stores messages internally — emails are NOT sent in this phase.
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={() => void createCampaign()}
          className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Draft campaign from selected contacts
        </button>
        <div className="mt-4 divide-y divide-slate-100">
          {campaigns.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">No campaigns yet.</p>
          ) : (
            campaigns.map((row) => (
              <CampaignRow
                key={row.id}
                row={row}
                readinessAllowed={readiness.allowed}
                disabled={loading}
                onMessage={setMessage}
                onLoading={setLoading}
                onQueued={() => router.refresh()}
              />
            ))
          )}
        </div>
      </section>

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
    </div>
  );
}

function ContactRow({
  row,
  disabled,
  onUpdated,
  onArchived,
  onMessage,
  onLoading,
}: Readonly<{
  row: FounderInvestorContactRecord;
  disabled: boolean;
  onUpdated: (contact: FounderInvestorContactRecord) => void;
  onArchived: (contactId: string) => void;
  onMessage: (message: string | null) => void;
  onLoading: (loading: boolean) => void;
}>) {
  const [editing, setEditing] = useState(false);

  async function updateStatus(status: string) {
    onLoading(true);
    onMessage(null);
    const response = await fetch(`/api/founder/investor-contacts/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const body = (await response.json().catch(() => null)) as {
      contact?: FounderInvestorContactRecord;
      error?: string;
    } | null;
    onLoading(false);
    if (!response.ok || !body?.contact) {
      onMessage(body?.error ?? "Unable to update contact.");
      return;
    }
    onUpdated(body.contact);
    onMessage("Contact updated.");
  }

  async function saveEdit(formData: FormData) {
    onLoading(true);
    onMessage(null);
    const response = await fetch(`/api/founder/investor-contacts/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        investor_name: formData.get("investor_name"),
        firm_name: formData.get("firm_name") || undefined,
        email: formData.get("email") || undefined,
        notes: formData.get("notes") || undefined,
        status: formData.get("status") || row.status,
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      contact?: FounderInvestorContactRecord;
      error?: string;
    } | null;
    onLoading(false);
    if (!response.ok || !body?.contact) {
      onMessage(body?.error ?? "Unable to save contact.");
      return;
    }
    onUpdated(body.contact);
    setEditing(false);
    onMessage("Contact saved.");
  }

  async function archive() {
    onLoading(true);
    onMessage(null);
    const response = await fetch(`/api/founder/investor-contacts/${row.id}`, { method: "DELETE" });
    onLoading(false);
    if (!response.ok) {
      onMessage("Unable to archive contact.");
      return;
    }
    onArchived(row.id);
    onMessage("Contact archived.");
  }

  if (editing) {
    return (
      <form
        className="py-3 text-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void saveEdit(new FormData(event.currentTarget));
        }}
      >
        <input name="investor_name" defaultValue={row.investor_name} required className="mb-2 w-full rounded border px-2 py-1" />
        <input name="firm_name" defaultValue={row.firm_name ?? ""} className="mb-2 w-full rounded border px-2 py-1" />
        <input name="email" type="email" defaultValue={row.email ?? ""} className="mb-2 w-full rounded border px-2 py-1" />
        <select name="status" defaultValue={row.status} className="mb-2 w-full rounded border px-2 py-1">
          {CONTACT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
          <option value="archived">archived</option>
        </select>
        <textarea name="notes" defaultValue={row.notes ?? ""} rows={2} className="mb-2 w-full rounded border px-2 py-1" />
        <div className="flex gap-2">
          <button type="submit" disabled={disabled} className="rounded border px-2 py-1 text-xs">
            Save
          </button>
          <button type="button" disabled={disabled} onClick={() => setEditing(false)} className="rounded border px-2 py-1 text-xs">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="py-3 text-sm">
      <p className="font-medium text-slate-900">
        {row.investor_name}
        {row.firm_name ? ` · ${row.firm_name}` : ""}
      </p>
      {row.email ? <p className="text-xs text-slate-500">{row.email}</p> : null}
      <p className="mt-1 text-xs text-slate-500">
        {row.status} · {row.source}
        {row.preferred_sectors ? ` · ${row.preferred_sectors}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={disabled} onClick={() => setEditing(true)} className="rounded border px-2 py-0.5 text-xs">
          Edit
        </button>
        <button type="button" disabled={disabled} onClick={() => void updateStatus("selected")} className="rounded border px-2 py-0.5 text-xs">
          Mark selected
        </button>
        <button type="button" disabled={disabled} onClick={() => void archive()} className="rounded border px-2 py-0.5 text-xs text-amber-800">
          Archive
        </button>
      </div>
    </div>
  );
}

function CampaignRow({
  row,
  readinessAllowed,
  disabled,
  onMessage,
  onLoading,
  onQueued,
}: Readonly<{
  row: OutreachCampaignRecord;
  readinessAllowed: boolean;
  disabled: boolean;
  onMessage: (message: string | null) => void;
  onLoading: (loading: boolean) => void;
  onQueued: () => void;
}>) {
  async function queueCampaign() {
    if (!readinessAllowed) {
      onMessage("Complete outreach readiness requirements before queueing.");
      return;
    }
    if (!window.confirm("Queue draft messages internally? No emails will be sent in this phase.")) {
      return;
    }
    onLoading(true);
    onMessage(null);
    const response = await fetch(`/api/founder/outreach/campaigns/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "queue" }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string; notice?: string };
    onLoading(false);
    if (!response.ok) {
      onMessage(body?.error ?? "Unable to queue campaign.");
      return;
    }
    onMessage(body?.notice ?? "Campaign queued.");
    onQueued();
  }

  return (
    <div className="py-3 text-sm">
      <p className="font-medium text-slate-900">{row.name}</p>
      <p className="text-xs text-slate-500">
        {row.status} · audience {row.audience_count} · daily limit {row.daily_limit}
      </p>
      {row.status === "draft" ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => void queueCampaign()}
          className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-900"
        >
          Queue drafts (no send)
        </button>
      ) : null}
    </div>
  );
}
