"use client";

import { useState } from "react";
import { formatApiError } from "@/lib/api/errors";
import type { Database } from "@/lib/supabase/types";

type DocRequest = Database["public"]["Tables"]["deal_room_document_requests"]["Row"];

export function DealRoomDocRequestsPanel({
  roomId,
  viewerRole,
  initialRequests,
}: {
  roomId: string;
  viewerRole: "founder" | "investor";
  initialRequests: DocRequest[];
}) {
  const [requests, setRequests] = useState<DocRequest[]>(initialRequests);
  const [type, setType] = useState("financials");
  const [custom, setCustom] = useState("");
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [docIdById, setDocIdById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</div> : null}

      {viewerRole === "investor" ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold text-slate-900">Request a document</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <select aria-label="Document request type" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
              {["financials","cap_table","legal_docs","customer_metrics","custom"].map((t) => (
                <option key={t} value={t}>{t}</option>
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
          {type === "custom" ? (
            <textarea aria-label="Custom document request" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" rows={2} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Custom request…" />
          ) : null}
          <p className="mt-2 text-xs text-slate-500">
            Private document storage paths are never shown. Founders may link existing uploaded docs.
          </p>
        </div>
      ) : null}

      {requests.length === 0 ? (
        <p className="text-sm text-slate-600">No document requests yet.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{r.request_type} · {r.status}</p>
              {r.custom_request ? <p className="mt-1 text-slate-700">{r.custom_request}</p> : null}
              {r.founder_note ? (
                <p className="mt-2 text-slate-700"><span className="font-semibold">Founder note:</span> {r.founder_note}</p>
              ) : null}
              {r.fulfilled_document_id ? (
                <p className="mt-2 text-xs text-slate-500">Fulfilled doc: {String(r.fulfilled_document_id).slice(0, 8)}…</p>
              ) : null}

              {viewerRole === "founder" && r.status !== "fulfilled" ? (
                <div className="mt-3 space-y-2">
                  <input
                    aria-label="Document ID to attach"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                    placeholder="Optional existing document UUID to attach"
                    value={docIdById[r.id] ?? ""}
                    onChange={(e) => setDocIdById((v) => ({ ...v, [r.id]: e.target.value }))}
                  />
                  <textarea
                    aria-label="Fulfillment note"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Response note (no legal advice)…"
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
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

