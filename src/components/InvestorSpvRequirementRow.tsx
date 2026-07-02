"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { formatParticipationRequirementCategory } from "@/lib/spv/participation-display";
import type { SpvParticipationRequirementRecord } from "@/lib/spv/types";
import { formatApiError } from "@/lib/api/errors";

function requirementDocument(req: SpvParticipationRequirementRecord) {
  const doc = Array.isArray(req.documents) ? req.documents[0] : req.documents;
  return doc ?? null;
}

export function InvestorSpvRequirementRow({
  requirement,
}: Readonly<{ requirement: SpvParticipationRequirementRecord }>) {
  const t = useTranslations("sharedCmp");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUpload = ["pending", "rejected"].includes(requirement.status);
  const awaitingReview = ["uploaded", "under_review"].includes(requirement.status);
  const doc = requirementDocument(requirement);

  async function uploadFile(file: File) {
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);

    const response = await fetch(
      `/api/investor/spv-participation-requirements/${requirement.id}/upload`,
      { method: "POST", body: formData },
    );

    setLoading(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(formatApiError(payload, "Upload failed."));
      return;
    }
    router.refresh();
  }

  return (
    <li className="rounded border border-slate-100 px-2 py-2 text-xs">
      <p className="font-medium text-slate-900">{requirement.title}</p>
      <p className="text-slate-500">
        {formatParticipationRequirementCategory(requirement.category)} · {requirement.status}
      </p>

      {requirement.status === "rejected" && requirement.review_notes ? (
        <p className="mt-1 text-red-800">Rejection reason: {requirement.review_notes}</p>
      ) : null}

      {awaitingReview ? (
        <p className="mt-1 text-indigo-700">
          Uploaded — awaiting review
          {doc?.file_name ? ` (${doc.file_name})` : ""}
        </p>
      ) : null}

      {requirement.status === "approved" ? (
        <p className="mt-1 text-emerald-800">{t("approved_operational_review_complete")}</p>
      ) : null}

      {requirement.status === "waived" ? (
        <p className="mt-1 text-slate-600">{t("waived_by_admin")}</p>
      ) : null}

      {canUpload ? (
        <div className="mt-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void uploadFile(file);
              }
            }}
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => fileRef.current?.click()}
            className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            Upload document
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-1 text-red-700">{error}</p> : null}
    </li>
  );
}
