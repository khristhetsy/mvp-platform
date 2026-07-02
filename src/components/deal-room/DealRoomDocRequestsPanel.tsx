"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatApiError } from "@/lib/api/errors";
import type { Database } from "@/lib/supabase/types";

type DocRequest = Database["public"]["Tables"]["deal_room_document_requests"]["Row"];

type FounderDoc = {
  id: string;
  file_name: string | null;
  document_type: string | null;
};

// --- Diligence pack bundles (#215) ---
const DILIGENCE_PACKS: Array<{
  id: string;
  label: string;
  description: string;
  types: string[];
}> = [
  {
    id: "seed",
    label: "Seed pack",
    description: "4 docs",
    types: ["financials", "cap_table", "pitch_deck", "legal_docs"],
  },
  {
    id: "series_a",
    label: "Series A pack",
    description: "5 docs",
    types: ["financials", "cap_table", "legal_docs", "customer_metrics", "pitch_deck"],
  },
  {
    id: "standard",
    label: "Standard diligence",
    description: "6 docs",
    types: ["financials", "cap_table", "legal_docs", "customer_metrics", "pitch_deck", "custom"],
  },
];

const DOC_TYPE_LABELS: Record<string, string> = {
  financials: "Financial statements",
  cap_table: "Cap table",
  pitch_deck: "Pitch deck",
  legal_docs: "Legal documents",
  customer_metrics: "Customer metrics",
  custom: "Additional documents",
};

export function DealRoomDocRequestsPanel({
  roomId,
  viewerRole,
  initialRequests,
  founderDocuments,
}: {
  roomId: string;
  viewerRole: "founder" | "investor";
  initialRequests: DocRequest[];
  founderDocuments?: FounderDoc[];
}) {
  const t = useTranslations("sharedCmp");
  const [requests, setRequests] = useState<DocRequest[]>(initialRequests);
  const [type, setType] = useState("financials");
  const [custom, setCustom] = useState("");
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [docIdById, setDocIdById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pack state (#215)
  const [packLoading, setPackLoading] = useState<string | null>(null);
  const [packSuccess, setPackSuccess] = useState<string | null>(null);
  const [showPackPanel, setShowPackPanel] = useState(false);

  async function requestDoc() {
    setLoading("request");
    setError(null);
    try {
      const res = await fetch(`/api/deal-room/${encodeURIComponent(roomId)}/doc-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_type: type, custom_request: type === "custom" ? custom : null }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw json;
      setRequests((v) => [json.request as DocRequest, ...v]);
      setCustom("");
    } catch (e) {
      setError(formatApiError(e, "Unable to request document."));
    } finally {
      setLoading(null);
    }
  }

  async function sendPack(packId: string) {
    const pack = DILIGENCE_PACKS.find((p) => p.id === packId);
    if (!pack) return;
    setPackLoading(packId);
    setPackSuccess(null);
    setError(null);
    try {
      const results = await Promise.allSettled(
        pack.types.map((docType) =>
          fetch(`/api/deal-room/${encodeURIComponent(roomId)}/doc-requests`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ request_type: docType, custom_request: null }),
          }).then((r) => r.json()),
        ),
      );
      const newRequests = results
        .filter((r): r is PromiseFulfilledResult<{ request: DocRequest }> => r.status === "fulfilled")
        .map((r) => r.value.request)
        .filter(Boolean);
      setRequests((v) => [...newRequests, ...v]);
      setPackSuccess(`${pack.label} sent — ${newRequests.length} requests added.`);
    } catch (e) {
      setError(formatApiError(e, "Unable to send diligence pack."));
    } finally {
      setPackLoading(null);
    }
  }

  async function fulfill(requestId: string) {
    setLoading(`fulfill:${requestId}`);
    setError(null);
    try {
      const res = await fetch(`/api/deal-room/${encodeURIComponent(roomId)}/doc-requests`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          status: "fulfilled",
          founder_note: noteById[requestId] ?? null,
          document_id: docIdById[requestId] ?? null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw json;
      const updated = json.request as DocRequest;
      setRequests((v) => v.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      setError(formatApiError(e, "Unable to fulfill request."));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </div>
      )}

      {/* --- INVESTOR: single request form + diligence pack sender (#215) --- */}
      {viewerRole === "investor" && (
        <div className="space-y-3">
          {/* Pack sender */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => setShowPackPanel((v) => !v)}
            >
              <div>
                <p className="text-sm font-semibold text-indigo-900">{t("diligence_packs")}</p>
                <p className="text-xs text-indigo-600">{t("send_a_preset_bundle_of_document_requests_at")}</p>
              </div>
              <svg
                className={`h-4 w-4 shrink-0 text-indigo-500 transition-transform ${showPackPanel ? "rotate-180" : ""}`}
                viewBox="0 0 16 16" fill="none" aria-hidden
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {showPackPanel && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {DILIGENCE_PACKS.map((pack) => (
                  <div
                    key={pack.id}
                    className="rounded-lg border border-indigo-200 bg-white p-3"
                  >
                    <p className="text-xs font-semibold text-slate-900">{pack.label}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {pack.types.map((t) => DOC_TYPE_LABELS[t] ?? t).join(", ")}
                    </p>
                    <button
                      type="button"
                      disabled={packLoading !== null}
                      onClick={() => void sendPack(pack.id)}
                      className="mt-2 w-full rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {packLoading === pack.id ? "Sending…" : `Send (${pack.types.length})`}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {packSuccess && (
              <p className="mt-2 text-xs font-semibold text-emerald-700">{packSuccess}</p>
            )}
          </div>

          {/* Single request */}
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-900">{t("request_a_document")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <select
                aria-label="Document request type"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {Object.entries(DOC_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={loading !== null || (type === "custom" && !custom.trim())}
                onClick={() => void requestDoc()}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading === "request" ? "Requesting…" : "Request"}
              </button>
            </div>
            {type === "custom" && (
              <textarea
                aria-label="Custom document request"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={2}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder={t("describe_the_custom_document_you_need")}
              />
            )}
            <p className="mt-2 text-xs text-slate-500">
              Private storage paths are never shown to investors. Founders may link existing uploads.
            </p>
          </div>
        </div>
      )}

      {/* --- REQUESTS LIST --- */}
      {requests.length === 0 ? (
        <p className="text-sm text-slate-600">{t("no_document_requests_yet")}</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {DOC_TYPE_LABELS[r.request_type] ?? r.request_type}
                  </p>
                  {r.custom_request && (
                    <p className="mt-1 text-slate-700">{r.custom_request}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    r.status === "fulfilled"
                      ? "bg-emerald-50 text-emerald-700"
                      : r.status === "cancelled"
                      ? "bg-slate-100 text-slate-500"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {r.status}
                </span>
              </div>

              {r.founder_note && (
                <p className="mt-2 text-slate-700">
                  <span className="font-semibold">Note: </span>{r.founder_note}
                </p>
              )}
              {r.fulfilled_document_id && (
                <p className="mt-1 text-xs text-slate-500">
                  Document attached · ID {String(r.fulfilled_document_id).slice(0, 8)}…
                </p>
              )}

              {/* --- FOUNDER: doc picker (#213) + fulfillment form --- */}
              {viewerRole === "founder" && r.status !== "fulfilled" && (
                <div className="mt-3 space-y-2">
                  {founderDocuments && founderDocuments.length > 0 ? (
                    <select
                      aria-label="Attach an existing document"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={docIdById[r.id] ?? ""}
                      onChange={(e) =>
                        setDocIdById((v) => ({ ...v, [r.id]: e.target.value }))
                      }
                    >
                      <option value="">— Attach an existing document (optional) —</option>
                      {founderDocuments.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.file_name ?? "Untitled"}
                          {doc.document_type ? ` · ${doc.document_type}` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      aria-label="Document ID to attach"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                      placeholder={t("optional_existing_document_uuid_to_attach")}
                      value={docIdById[r.id] ?? ""}
                      onChange={(e) =>
                        setDocIdById((v) => ({ ...v, [r.id]: e.target.value }))
                      }
                    />
                  )}
                  <textarea
                    aria-label="Fulfillment note"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    rows={2}
                    placeholder={t("response_note_no_legal_advice")}
                    value={noteById[r.id] ?? ""}
                    onChange={(e) => setNoteById((v) => ({ ...v, [r.id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    disabled={loading !== null}
                    onClick={() => void fulfill(r.id)}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {loading === `fulfill:${r.id}` ? "Saving…" : "Mark fulfilled"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
