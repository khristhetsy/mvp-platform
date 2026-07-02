"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Check, Download, Pencil, Loader2, FileText, Info } from "lucide-react";
import { REGCF_DOCS, type RegCfDocKey } from "@/lib/regcf/documents";

type DocState = { content: string; ai_generated: boolean };

export function RegCfGeneratorClient() {
  const t = useTranslations("founderCmp");
  const [docs, setDocs] = useState<Record<string, DocState>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<RegCfDocKey | null>(null);
  const [editing, setEditing] = useState<RegCfDocKey | null>(null);
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/founder/regcf/documents");
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        const map: Record<string, DocState> = {};
        for (const d of data.documents ?? []) map[d.doc_key] = { content: d.content ?? "", ai_generated: d.ai_generated };
        setDocs(map);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const generate = useCallback(async (key: RegCfDocKey) => {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch(`/api/founder/regcf/documents/${key}/generate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Generation failed.");
      setDocs((p) => ({ ...p, [key]: { content: data.content, ai_generated: data.aiGenerated } }));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setBusy(null);
    }
  }, []);

  const startEdit = useCallback((key: RegCfDocKey) => {
    setEditing(key);
    setDraft(docs[key]?.content ?? "");
  }, [docs]);

  const save = useCallback(async (key: RegCfDocKey) => {
    setBusy(key);
    try {
      const res = await fetch(`/api/founder/regcf/documents/${key}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: draft }),
      });
      if (!res.ok) throw new Error();
      setDocs((p) => ({ ...p, [key]: { content: draft, ai_generated: p[key]?.ai_generated ?? false } }));
      setEditing(null);
    } catch {
      setMsg("Could not save.");
    } finally {
      setBusy(null);
    }
  }, [draft]);

  const draftedCount = useMemo(() => Object.values(docs).filter((d) => d.content?.trim()).length, [docs]);

  const downloadPacket = useCallback(() => {
    const parts = REGCF_DOCS.filter((d) => docs[d.key]?.content?.trim()).map(
      (d) => `# ${d.label}\n\n${docs[d.key].content}\n`,
    );
    const blob = new Blob([parts.join("\n\n---\n\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reg-cf-prep-packet.md";
    a.click();
    URL.revokeObjectURL(url);
  }, [docs]);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-[#FAC775] bg-[#FAEEDA] px-4 py-3">
        <Info className="h-5 w-5 shrink-0 text-[#854F0B]" aria-hidden />
        <p className="text-sm leading-6 text-[#633806]">
          <strong>Drafts only — not legal or investment advice.</strong> You own these documents and are responsible for them; have counsel review before use. iCapOS does not post, offer, solicit, host, or transact any securities, and is not the issuer or intermediary.
        </p>
      </div>

      {msg ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{msg}</p> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
        {loading ? (
          <p className="px-4 py-8 text-sm text-slate-400">{t("loading")}</p>
        ) : (
          <ul>
            {REGCF_DOCS.map((d) => {
              const has = Boolean(docs[d.key]?.content?.trim());
              const isEditing = editing === d.key;
              return (
                <li key={d.key} className="border-b border-slate-100 px-4 py-3 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEEDFE] text-[#1A6CE4]"><FileText className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                        {d.label}
                        {d.counsel ? <span className="rounded bg-[#FCEBEB] px-1.5 text-[10px] font-medium text-[#A32D2D]">counsel</span> : null}
                      </p>
                      <p className="text-xs text-slate-500">{d.description}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {has ? (
                        <button type="button" onClick={() => startEdit(d.key)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                      ) : null}
                      <button type="button" disabled={busy === d.key} onClick={() => void generate(d.key)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E78F5] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1A6CE4] disabled:opacity-50">
                        {busy === d.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : has ? <Sparkles className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {busy === d.key ? "Drafting…" : has ? "Regenerate" : "Generate"}
                      </button>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="mt-3">
                      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={12} className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs leading-relaxed focus:border-[#2E78F5] focus:outline-none" />
                      <div className="mt-2 flex items-center gap-2">
                        <button type="button" disabled={busy === d.key} onClick={() => void save(d.key)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"><Check className="h-3.5 w-3.5" /> Save</button>
                        <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">{t("cancel")}</button>
                      </div>
                    </div>
                  ) : has ? (
                    <p className="mt-2 line-clamp-2 whitespace-pre-wrap pl-11 text-xs text-slate-500">{docs[d.key].content}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={downloadPacket} disabled={draftedCount === 0} className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E78F5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1A6CE4] disabled:opacity-50">
          <Download className="h-4 w-4" /> Download prep packet
        </button>
        <span className="text-xs text-slate-400">{draftedCount} of {REGCF_DOCS.length} drafted</span>
      </div>
    </div>
  );
}
