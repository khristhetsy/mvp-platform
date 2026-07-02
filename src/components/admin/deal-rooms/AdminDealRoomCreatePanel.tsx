"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

type CompanyOption = { id: string; company_name: string };
type InvestorOption = {
  id: string;
  firm_name: string | null;
  profileLabel: string;
};

type Props = {
  companies: CompanyOption[];
  investors: InvestorOption[];
};

export function AdminDealRoomCreatePanel({ companies, investors }: Props) {
  const t = useTranslations("adminCmp");
  const router = useRouter();
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [investorProfileId, setInvestorProfileId] = useState(investors[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [spvId, setSpvId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [status, setStatus] = useState<"pending" | "active">("pending");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!companyId || !investorProfileId || title.trim().length < 3) {
      setError("Select a company and investor, and enter a title (min 3 characters).");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/deal-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          investorProfileId,
          title: title.trim(),
          status,
          spvId: spvId.trim() || null,
          campaignId: campaignId.trim() || null,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof payload.error === "string" ? payload.error : "Unable to create deal room.");
        return;
      }

      const roomId = payload.room?.id as string | undefined;
      setSuccess("Deal room created.");
      setTitle("");
      router.refresh();
      if (roomId) {
        router.push(`/admin/deal-rooms/${roomId}`);
      }
    } catch {
      setError("Unable to create deal room.");
    } finally {
      setSubmitting(false);
    }
  }

  if (companies.length === 0 || investors.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Add at least one company and one investor profile before creating a deal room.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-slate-700">{t("company")}</span>
        <select
          value={companyId}
          onChange={(event) => setCompanyId(event.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2"
        >
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.company_name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium text-slate-700">{t("investor")}</span>
        <select
          value={investorProfileId}
          onChange={(event) => setInvestorProfileId(event.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2"
        >
          {investors.map((investor) => (
            <option key={investor.id} value={investor.id}>
              {investor.profileLabel}
              {investor.firm_name ? ` · ${investor.firm_name}` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm md:col-span-2">
        <span className="font-medium text-slate-700">{t("room_title")}</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("e_g_series_a_diligence_acme_co_example_capit")}
          className="rounded-lg border border-slate-200 px-3 py-2"
          minLength={3}
          required
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium text-slate-700">{t("status")}</span>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as "pending" | "active")}
          className="rounded-lg border border-slate-200 px-3 py-2"
        >
          <option value="pending">Pending</option>
          <option value="active">Active</option>
        </select>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium text-slate-700">{t("spv_id_optional")}</span>
        <input
          value={spvId}
          onChange={(event) => setSpvId(event.target.value)}
          placeholder={t("uuid")}
          className="rounded-lg border border-slate-200 px-3 py-2"
        />
      </label>

      <label className="grid gap-1 text-sm md:col-span-2">
        <span className="font-medium text-slate-700">{t("campaign_id_optional")}</span>
        <input
          value={campaignId}
          onChange={(event) => setCampaignId(event.target.value)}
          placeholder={t("uuid")}
          className="rounded-lg border border-slate-200 px-3 py-2"
        />
      </label>

      {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
      {success ? <p className="md:col-span-2 text-sm text-emerald-700">{success}</p> : null}

      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 rounded-lg bg-[var(--blue)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create deal room"}
        </button>
      </div>
    </form>
  );
}
