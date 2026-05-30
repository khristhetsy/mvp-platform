"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FounderOutreachPipelinePanel } from "@/components/FounderOutreachPipelinePanel";
import { FounderSocialDraftsPanel } from "@/components/FounderSocialDraftsPanel";
import type { EnrichedOutreachTarget } from "@/lib/founder-crm/outreach";
import type { OutreachReadinessResult } from "@/lib/founder-crm/outreach-readiness";
import type { SocialOutreachReadinessResult } from "@/lib/founder-crm/social-outreach-readiness";
import type {
  FounderInvestorContactRecord,
  OutreachCampaignRecord,
  SocialOutreachDraftRecord,
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
  targets: EnrichedOutreachTarget[];
  campaigns: OutreachCampaignRecord[];
  readiness: OutreachReadinessResult;
  platformMatches: PlatformMatch[];
  followUpCount: number;
  socialDrafts: SocialOutreachDraftRecord[];
  socialReadiness: SocialOutreachReadinessResult;
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
  targets: initialTargets,
  campaigns: initialCampaigns,
  readiness,
  platformMatches,
  followUpCount,
  socialDrafts,
  socialReadiness,
}: Readonly<Props>) {
  const router = useRouter();
  const [hubTab, setHubTab] = useState<"crm" | "pipeline" | "social">("crm");
  const [contacts, setContacts] = useState(initialContacts);
  const [targets, setTargets] = useState(initialTargets);
  const [campaigns] = useState(initialCampaigns);

  useEffect(() => {
    setTargets(initialTargets);
  }, [initialTargets]);
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

  const contactInPipeline = useMemo(() => {
    const map = new Map<string, EnrichedOutreachTarget>();
    for (const row of targets) {
      if (row.contact_id) {
        map.set(row.contact_id, row);
      }
    }
    return map;
  }, [targets]);

  const platformInPipeline = useMemo(() => {
    const map = new Map<string, EnrichedOutreachTarget>();
    for (const row of targets) {
      if (row.platform_investor_id) {
        map.set(row.platform_investor_id, row);
      }
    }
    return map;
  }, [targets]);

  async function postOutreachTarget(body: Record<string, unknown>) {
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/founder/outreach/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setLoading(false);
    if (!response.ok) {
      setMessage(payload?.error ?? "Unable to update outreach target.");
      return false;
    }
    router.refresh();
    return true;
  }

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
        linkedin_url: formData.get("linkedin_url") || undefined,
        twitter_url: formData.get("twitter_url") || undefined,
        crunchbase_url: formData.get("crunchbase_url") || undefined,
        personal_website_url: formData.get("personal_website_url") || undefined,
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
        linkedin_url: row.linkedin_url,
        twitter_url: row.twitter_url,
        crunchbase_url: row.crunchbase_url,
        personal_website_url: row.personal_website_url,
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
    const pipelineTargetIds = targets
      .filter((row) => row.contact_id && row.status === "selected")
      .map((row) => row.id)
      .slice(0, 25);

    if (pipelineTargetIds.length === 0) {
      setMessage("Add private contacts to the pipeline (selected status) first.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/founder/outreach/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${companyName} outreach ${new Date().toLocaleDateString("en-US")}`,
        targetIds: pipelineTargetIds,
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
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setHubTab("crm")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${hubTab === "crm" ? "bg-indigo-600 text-white" : "text-slate-600"}`}
        >
          CRM &amp; email outreach
        </button>
        <button
          type="button"
          onClick={() => setHubTab("pipeline")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${hubTab === "pipeline" ? "bg-indigo-600 text-white" : "text-slate-600"}`}
        >
          Outreach pipeline ({targets.length})
        </button>
        <button
          type="button"
          onClick={() => setHubTab("social")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${hubTab === "social" ? "bg-indigo-600 text-white" : "text-slate-600"}`}
        >
          Social drafts
        </button>
      </div>

      {hubTab === "pipeline" ? (
        <FounderOutreachPipelinePanel
          targets={targets}
          campaigns={campaigns}
          readiness={readiness}
          companyName={companyName}
          onTargetsChange={setTargets}
          onMessage={setMessage}
        />
      ) : null}

      {hubTab === "social" ? (
        <FounderSocialDraftsPanel
          initialDrafts={socialDrafts}
          socialReadiness={socialReadiness}
          campaigns={campaigns}
        />
      ) : null}

      {hubTab === "crm" ? (
        <>
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
            <input name="linkedin_url" type="url" placeholder="LinkedIn URL" className="rounded-lg border px-3 py-2 text-sm" />
            <input name="twitter_url" type="url" placeholder="X / Twitter URL" className="rounded-lg border px-3 py-2 text-sm" />
            <input name="crunchbase_url" type="url" placeholder="Crunchbase URL" className="rounded-lg border px-3 py-2 text-sm" />
            <input name="personal_website_url" type="url" placeholder="Personal website" className="rounded-lg border px-3 py-2 text-sm" />
            <textarea name="notes" placeholder="Notes" rows={2} className="rounded-lg border px-3 py-2 text-sm" />
            <button type="submit" disabled={loading} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
              Add contact
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Import CSV</h2>
          <p className="mt-1 text-xs text-slate-500">
            Columns: investor_name, firm_name, email, investor_type, sector, stage, check_size, geography, website, linkedin_url, twitter_url, crunchbase_url, personal_website_url, notes
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
                pipelineTarget={contactInPipeline.get(row.id)}
                disabled={loading}
                onSelectForOutreach={() =>
                  void postOutreachTarget({ action: "select", contactId: row.id }).then((ok) => {
                    if (ok) {
                      setMessage("Selected for outreach.");
                    }
                  })
                }
                onMoveToPipeline={() =>
                  void postOutreachTarget({ action: "move_to_pipeline", contactId: row.id }).then((ok) => {
                    if (ok) {
                      setMessage("Moved to outreach pipeline.");
                      setHubTab("pipeline");
                    }
                  })
                }
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
        <h2 className="text-lg font-semibold text-slate-950">Platform matched investors</h2>
        <p className="mt-1 text-sm text-slate-600">CapitalOS registered investors — separate from your private CRM.</p>
        <div className="mt-4 divide-y divide-slate-100">
          {platformMatches.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">No platform matches available yet.</p>
          ) : (
            platformMatches.map((row) => {
              const pipelineTarget = platformInPipeline.get(row.platformInvestorId);
              return (
                <div key={row.platformInvestorId} className="py-3 text-sm">
                  <p className="font-medium text-slate-900">
                    {row.label} · {row.matchScore}% match
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{row.matchReasons.slice(0, 2).join(" · ")}</p>
                  {pipelineTarget ? (
                    <p className="mt-1 text-xs text-indigo-600">In pipeline · {pipelineTarget.status}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        void postOutreachTarget({
                          action: "select",
                          platformInvestorId: row.platformInvestorId,
                          matchScore: row.matchScore,
                        }).then((ok) => {
                          if (ok) {
                            setMessage("Platform investor selected for outreach.");
                          }
                        })
                      }
                      className="rounded border px-2 py-0.5 text-xs"
                    >
                      Select for outreach
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        void postOutreachTarget({
                          action: "move_to_pipeline",
                          platformInvestorId: row.platformInvestorId,
                          matchScore: row.matchScore,
                        }).then((ok) => {
                          if (ok) {
                            setMessage("Moved to outreach pipeline.");
                            setHubTab("pipeline");
                          }
                        })
                      }
                      className="rounded border px-2 py-0.5 text-xs"
                    >
                      Move to pipeline
                    </button>
                  </div>
                </div>
              );
            })
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
          Draft campaign from pipeline contacts
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
        </>
      ) : null}
    </div>
  );
}

function ContactRow({
  row,
  pipelineTarget,
  disabled,
  onSelectForOutreach,
  onMoveToPipeline,
  onUpdated,
  onArchived,
  onMessage,
  onLoading,
}: Readonly<{
  row: FounderInvestorContactRecord;
  pipelineTarget?: EnrichedOutreachTarget;
  disabled: boolean;
  onSelectForOutreach: () => void;
  onMoveToPipeline: () => void;
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
        linkedin_url: formData.get("linkedin_url") || undefined,
        twitter_url: formData.get("twitter_url") || undefined,
        crunchbase_url: formData.get("crunchbase_url") || undefined,
        personal_website_url: formData.get("personal_website_url") || undefined,
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
        <input name="linkedin_url" type="url" defaultValue={row.linkedin_url ?? ""} placeholder="LinkedIn" className="mb-2 w-full rounded border px-2 py-1" />
        <input name="twitter_url" type="url" defaultValue={row.twitter_url ?? ""} placeholder="X / Twitter" className="mb-2 w-full rounded border px-2 py-1" />
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
      {row.linkedin_url ? (
        <p className="text-xs text-indigo-600">
          <a href={row.linkedin_url} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        </p>
      ) : null}
      <p className="mt-1 text-xs text-slate-500">
        {row.status} · {row.source}
        {row.preferred_sectors ? ` · ${row.preferred_sectors}` : ""}
        {pipelineTarget ? ` · pipeline: ${pipelineTarget.status}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={disabled} onClick={onSelectForOutreach} className="rounded border px-2 py-0.5 text-xs">
          Select for outreach
        </button>
        <button type="button" disabled={disabled} onClick={onMoveToPipeline} className="rounded border px-2 py-0.5 text-xs">
          Move to pipeline
        </button>
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
