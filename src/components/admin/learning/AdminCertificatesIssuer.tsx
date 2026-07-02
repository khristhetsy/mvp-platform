"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { formatApiError } from "@/lib/api/errors";

type Props = {
  onIssued?: () => void;
};

type IssueCertificateResponse = {
  certificate?: {
    certificate_code?: string | null;
  };
};

export function AdminCertificatesIssuer({ onIssued }: Props) {
  const t = useTranslations("adminCmp");
  const [founderId, setFounderId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [programId, setProgramId] = useState("");
  const [title, setTitle] = useState("Certificate of Completion");
  const [status, setStatus] = useState<"issued" | "revoked" | "archived">("issued");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function issue() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/learning/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          founder_id: founderId,
          company_id: companyId.trim() ? companyId.trim() : null,
          program_id: programId.trim() ? programId.trim() : null,
          certificate_title: title,
          status,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as IssueCertificateResponse;
      if (!res.ok) throw json;
      setSuccess(`Issued ${json.certificate?.certificate_code ?? "certificate"}.`);
      onIssued?.();
    } catch (e) {
      setError(formatApiError(e, "Unable to issue certificate."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Certificates of Completion only. No accreditation, qualification, investment readiness, or funding guarantees.
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate-600">{t("founder_user_id_uuid")}</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
            value={founderId}
            onChange={(e) => setFounderId(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">{t("company_id_optional")}</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate-600">{t("course_program_id_optional")}</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">{t("status")}</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as "issued" | "revoked" | "archived")}
          >
            <option value="issued">issued</option>
            <option value="revoked">revoked</option>
            <option value="archived">archived</option>
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-slate-600">{t("certificate_title")}</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</div> : null}
      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{success}</div>
      ) : null}

      <button
        type="button"
        disabled={loading || !founderId.trim()}
        onClick={() => void issue()}
        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {loading ? "Issuing…" : "Issue certificate"}
      </button>
    </div>
  );
}

