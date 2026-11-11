"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import type { Gap } from "@/lib/support/assistant-gaps";

type Taught = { id: string; question: string; answer: string };
type Source = { id: string; file_name: string; bytes: number; status: "processing" | "trained" | "failed"; created_at: string };
type Turn = { question: string; reply: string; source: "taught" | "ai" | "handoff" | "offline" };

const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#1A6CE4] focus:ring-2 focus:ring-[#1A6CE4]/20 disabled:bg-slate-50";
const btnPrimary = "rounded-lg bg-[#1A6CE4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2E78F5] disabled:opacity-50";
const btnGhost = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const card = "rounded-xl border border-slate-200 bg-white p-5";

const SOURCE_LABEL: Record<Turn["source"], string> = {
  taught: "Source: taught answer",
  ai: "Source: AI, from the product knowledge, taught answers and PDFs",
  handoff: "Source: handoff rule",
  offline: "Source: not available",
};

async function readJson<T>(res: Response): Promise<T & { error?: string }> {
  return (await res.json().catch(() => ({}))) as T & { error?: string };
}

export function SupportTrainClient({
  canEdit,
  defaultBrief,
  initialBrief,
  initialTaught,
  initialSources,
  initialGaps,
}: {
  canEdit: boolean;
  defaultBrief: string;
  initialBrief: string | null;
  initialTaught: Taught[];
  initialSources: Source[];
  initialGaps: Gap[];
}) {
  const { toast } = useToast();
  const [brief, setBrief] = useState(initialBrief ?? defaultBrief);
  const [briefSaved, setBriefSaved] = useState(initialBrief !== null);
  const [taught, setTaught] = useState(initialTaught);
  const [sources, setSources] = useState(initialSources);
  const [gaps, setGaps] = useState(initialGaps);
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [testQ, setTestQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState<"" | "brief" | "teach" | "pdf" | "test">("");
  const pdfRef = useRef<HTMLInputElement>(null);
  const teachRef = useRef<HTMLElement>(null);

  const fail = (title: string, e: unknown, fallback: string) => toast({ title, description: e instanceof Error ? e.message : fallback, variant: "error" });

  const saveBrief = async (text: string) => {
    setBusy("brief");
    try {
      const res = await fetch("/api/admin/support/assistant/brief", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const j = await readJson<{ usingDefault: boolean }>(res);
      if (!res.ok) throw new Error(j.error ?? "Could not save.");
      setBriefSaved(!j.usingDefault);
      toast({ title: "Saved", description: j.usingDefault ? "The assistant is using the built in knowledge." : "The assistant uses this knowledge from now on.", variant: "success" });
    } catch (e) {
      fail("Not saved", e, "Could not save.");
    } finally {
      setBusy("");
    }
  };

  const teach = async () => {
    setBusy("teach");
    try {
      const res = await fetch("/api/admin/support/assistant/answers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, answer: a }) });
      const j = await readJson<{ answer: Taught }>(res);
      if (!res.ok) throw new Error(j.error ?? "Could not save.");
      setTaught((t) => [j.answer, ...t]);
      // A taught answer closes any gap it now covers.
      const asked = q.trim().toLowerCase();
      setGaps((g) => g.filter((x) => x.question.trim().toLowerCase() !== asked));
      setQ("");
      setA("");
      toast({ title: "Taught", description: "The assistant uses this answer from now on.", variant: "success" });
    } catch (e) {
      fail("Not saved", e, "Could not save.");
    } finally {
      setBusy("");
    }
  };

  const forget = async (id: string) => {
    const res = await fetch(`/api/admin/support/assistant/answers?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setTaught((t) => t.filter((x) => x.id !== id));
  };

  const uploadPdf = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf") || file.type !== "application/pdf") {
      toast({ title: "PDF only", description: "Only PDF files can be uploaded. Please convert this document to PDF and try again.", variant: "error" });
      return;
    }
    setBusy("pdf");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/support/assistant/sources", { method: "POST", body: fd });
      const j = await readJson<{ source: Source; message: string }>(res);
      if (!res.ok) throw new Error(j.error ?? "Upload failed.");
      setSources((s) => [j.source, ...s]);
      toast({ title: j.source.status === "trained" ? "Trained" : "Could not read", description: j.message, variant: j.source.status === "trained" ? "success" : "error" });
    } catch (e) {
      fail("Upload failed", e, "Upload failed.");
    } finally {
      setBusy("");
      if (pdfRef.current) pdfRef.current.value = "";
    }
  };

  const removePdf = async (id: string) => {
    const res = await fetch(`/api/admin/support/assistant/sources?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setSources((s) => s.filter((x) => x.id !== id));
  };

  const dismiss = async (gap: Gap) => {
    const res = await fetch("/api/admin/support/assistant/gaps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: gap.question }) });
    if (res.ok) setGaps((g) => g.filter((x) => x.key !== gap.key));
  };

  const writeAnswer = (gap: Gap) => {
    setQ(gap.question);
    setA("");
    teachRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const ask = async () => {
    const question = testQ.trim();
    if (!question) return;
    setBusy("test");
    try {
      const res = await fetch("/api/admin/support/assistant/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const j = await readJson<{ reply: string; source: Turn["source"] }>(res);
      if (!res.ok) throw new Error(j.error ?? "Could not test.");
      setTurns((t) => [...t, { question, reply: j.reply, source: j.source }]);
      setTestQ("");
    } catch (e) {
      fail("Test failed", e, "Could not test.");
    } finally {
      setBusy("");
    }
  };

  const checklist = [
    { done: briefSaved, label: "Product knowledge saved" },
    { done: sources.some((s) => s.status === "trained"), label: "One PDF trained" },
    { done: taught.length >= 1, label: "One answer taught" },
  ];
  const locked = !canEdit;

  return (
    <div className="space-y-5">
      {locked ? <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">You can view this page. Only admins can change the training.</p> : null}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <section className={card}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">1. Product knowledge</h2>
                <p className="mt-1 text-sm text-slate-600">What the assistant knows about iCapOS. Keep {"{{PLANS}}"} where the plan list goes: it is filled from Admin Pricing, so prices are never typed here.</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${briefSaved ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{briefSaved ? "Edited" : "Built in"}</span>
            </div>
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)} disabled={locked} maxLength={6000} className={`${input} mt-3 min-h-[220px]`} />
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => void saveBrief(brief)} disabled={locked || busy === "brief" || !brief.trim()} className={btnPrimary}>
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setBrief(defaultBrief);
                  void saveBrief("");
                }}
                disabled={locked || busy === "brief" || !briefSaved}
                className={btnGhost}
              >
                Use built in text
              </button>
            </div>
          </section>

          <section className={card}>
            <h2 className="text-base font-semibold text-slate-950">2. Documents</h2>
            <p className="mt-1 text-sm text-slate-600">PDF only. Help guides, how to documents, policy pages. The text is read once and the assistant answers from it.</p>
            <input ref={pdfRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && void uploadPdf(e.target.files[0])} />
            <button type="button" onClick={() => pdfRef.current?.click()} disabled={locked || busy === "pdf"} className={`${btnPrimary} mt-3`}>
              {busy === "pdf" ? "Working..." : "Upload PDF"}
            </button>
            <ul className="mt-4 divide-y divide-slate-100">
              {sources.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{s.file_name}</p>
                    <p className="text-xs text-slate-500">
                      {(s.bytes / 1024 / 1024).toFixed(1)} MB,{" "}
                      <span className={s.status === "trained" ? "text-emerald-700" : s.status === "failed" ? "text-red-700" : ""}>{s.status === "trained" ? "Trained" : s.status === "failed" ? "No readable text" : "Processing"}</span>
                    </p>
                  </div>
                  <button type="button" onClick={() => void removePdf(s.id)} disabled={locked} className="shrink-0 text-xs text-slate-500 hover:text-red-700 disabled:opacity-50">
                    Remove
                  </button>
                </li>
              ))}
              {!sources.length ? <li className="py-2.5 text-sm text-slate-500">No PDFs yet.</li> : null}
            </ul>
          </section>

          <section ref={teachRef} className={card}>
            <h2 className="text-base font-semibold text-slate-950">3. Teach an answer</h2>
            <p className="mt-1 text-sm text-slate-600">When a founder asks something close to this question, the assistant replies with your answer, word for word, before the AI runs.</p>
            <input value={q} onChange={(e) => setQ(e.target.value)} disabled={locked} className={`${input} mt-3`} maxLength={200} placeholder="Question, in the founder's words" />
            <textarea value={a} onChange={(e) => setA(e.target.value)} disabled={locked} className={`${input} mt-2 min-h-[80px]`} maxLength={600} placeholder="Approved answer. Plain and short. No guarantees or funding promises." />
            <button type="button" onClick={() => void teach()} disabled={locked || busy === "teach" || q.trim().length < 3 || a.trim().length < 2} className={`${btnPrimary} mt-3`}>
              Add answer
            </button>
            <ul className="mt-5 divide-y divide-slate-100">
              {taught.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{t.question}</p>
                    <p className="mt-0.5 text-slate-600">{t.answer}</p>
                  </div>
                  <button type="button" onClick={() => void forget(t.id)} disabled={locked} className="shrink-0 text-xs text-slate-500 hover:text-red-700 disabled:opacity-50">
                    Remove
                  </button>
                </li>
              ))}
              {!taught.length ? <li className="py-3 text-sm text-slate-500">Nothing taught yet.</li> : null}
            </ul>
          </section>
        </div>

        <div className="space-y-5">
          <section className={card}>
            <h2 className="text-base font-semibold text-slate-950">4. Gaps to fill</h2>
            <p className="mt-1 text-sm text-slate-600">Questions founders marked &quot;I still need a person&quot; in the last 60 days. Write the answer once and the assistant has it.</p>
            <ul className="mt-3 space-y-2">
              {gaps.map((g) => (
                <li key={g.key} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-sm">
                  <p className="font-medium text-slate-900">{g.question}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Asked {g.count} {g.count === 1 ? "time" : "times"}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => writeAnswer(g)} disabled={locked} className={btnPrimary}>
                      Write answer
                    </button>
                    <button type="button" onClick={() => void dismiss(g)} disabled={locked} className={btnGhost}>
                      Dismiss
                    </button>
                  </div>
                </li>
              ))}
              {!gaps.length ? <li className="text-sm text-slate-500">No open gaps.</li> : null}
            </ul>
          </section>

          <section className={card}>
            <h2 className="text-base font-semibold text-slate-950">5. Test it</h2>
            <p className="mt-1 text-sm text-slate-600">Ask as a founder would. It opens no request and writes nothing to the support log.</p>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto rounded-lg bg-slate-100 p-3">
              {turns.map((t, i) => (
                <div key={i} className="space-y-1.5 text-sm">
                  <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-[#1A6CE4] px-3 py-1.5 text-white">{t.question}</p>
                  <div className="w-fit max-w-[85%] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-800">
                    <p className="whitespace-pre-wrap">{t.reply}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{SOURCE_LABEL[t.source]}</p>
                  </div>
                </div>
              ))}
              {!turns.length ? <p className="text-sm text-slate-500">No test questions yet.</p> : null}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void ask();
              }}
            >
              <input value={testQ} onChange={(e) => setTestQ(e.target.value)} disabled={locked} className={input} maxLength={1000} placeholder="Type a test question" />
              <button type="submit" disabled={locked || busy === "test" || !testQ.trim()} className={btnPrimary}>
                {busy === "test" ? "..." : "Ask"}
              </button>
            </form>
          </section>

          <section className={card}>
            <h2 className="text-base font-semibold text-slate-950">Handoff rule</h2>
            <p className="mt-1 text-sm text-slate-600">Always goes to a person: billing and refunds, bugs, document reviews, and anything about the founder&apos;s own numbers. Turn the assistant off in Notifications and AI, on the Support page.</p>
            <h3 className="mt-4 text-sm font-semibold text-slate-950">Training checklist</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-center gap-2">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${c.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>{c.done ? "✓" : "·"}</span>
                  <span className={c.done ? "text-slate-900" : "text-slate-600"}>{c.label}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
