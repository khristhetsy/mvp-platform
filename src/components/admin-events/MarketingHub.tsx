"use client";

import { useState } from "react";
import { Sparkles, Copy, Check } from "lucide-react";
import type { EventMarketing } from "@/lib/icfo-events/marketing";

type Tab = "seo" | "brochure" | "email" | "social";
const TABS: { key: Tab; label: string }[] = [
  { key: "seo", label: "SEO" },
  { key: "brochure", label: "Brochure" },
  { key: "email", label: "Email invite" },
  { key: "social", label: "Social" },
];

const labelCls = "mb-1 block text-xs font-medium text-[var(--text-secondary)]";
const inputCls = "w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm";

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked — no-op */
        }
      }}
      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--blue)] hover:underline disabled:opacity-50"
      disabled={!text}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

export function MarketingHub({
  eventId,
  eventTitle,
  initial,
  claudeConfigured,
}: {
  eventId: string;
  eventTitle: string;
  initial: EventMarketing;
  claudeConfigured: boolean;
}) {
  const [m, setM] = useState<EventMarketing>(initial);
  const [tab, setTab] = useState<Tab>("seo");
  const [tone, setTone] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(initial.updatedAt);
  const [dirty, setDirty] = useState(false);

  function patch(next: Partial<EventMarketing>) {
    setM((prev) => ({ ...prev, ...next }));
    setDirty(true);
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/marketing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone: tone || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Generation failed.");
      setM(json.marketing as EventMarketing);
      setDirty(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/marketing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seoTitle: m.seoTitle,
          seoDescription: m.seoDescription,
          seoKeywords: m.seoKeywords,
          brochure: m.brochure,
          email: m.email,
          social: m.social,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Save failed.");
      setM(json.marketing as EventMarketing);
      setSavedAt((json.marketing as EventMarketing).updatedAt);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[var(--navy)]">Marketing Hub</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Draft, edit, and store the marketing kit for <span className="font-medium text-[var(--navy)]">{eventTitle}</span>.
            SEO is applied to the public event page automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
          {!dirty && savedAt && <span className="text-xs text-[var(--text-muted)]">Saved {new Date(savedAt).toLocaleString()}</span>}
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save kit"}
          </button>
        </div>
      </div>

      {/* AI campaign kit */}
      <div className="mt-4 rounded-lg border border-[var(--indigo)] bg-[var(--indigo-soft)] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--indigo)]" />
          <span className="text-sm font-medium text-[var(--navy)]">AI campaign kit</span>
          <input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="Optional tone (e.g. bold, formal)"
            className="ml-auto w-48 rounded-md border border-[var(--border-subtle)] bg-white px-2.5 py-1.5 text-xs"
          />
          <button
            onClick={generate}
            disabled={generating}
            className="rounded-md bg-[var(--indigo)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {generating ? "Drafting…" : "Generate all sections"}
          </button>
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {claudeConfigured
            ? "Drafts SEO, brochure, email, and social from this event's real details. Review and Save to keep them."
            : "AI is not configured — Generate fills a template built from this event's details. Review and Save to keep them."}
        </p>
      </div>

      {/* tabs */}
      <div className="mt-4 flex gap-1 border-b border-[var(--border-subtle)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key ? "border-[var(--indigo)] text-[var(--indigo)]" : "border-transparent text-[var(--text-secondary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "seo" && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>SEO title <span className="text-[var(--text-muted)]">({m.seoTitle.length}/60)</span></label>
              <input value={m.seoTitle} maxLength={120} onChange={(e) => patch({ seoTitle: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Meta description <span className="text-[var(--text-muted)]">({m.seoDescription.length}/160)</span></label>
              <textarea value={m.seoDescription} maxLength={320} rows={3} onChange={(e) => patch({ seoDescription: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Keywords</label>
              <input value={m.seoKeywords} maxLength={500} onChange={(e) => patch({ seoKeywords: e.target.value })} className={inputCls} placeholder="comma, separated, keywords" />
            </div>
          </div>
        )}

        {tab === "brochure" && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Headline</label>
              <input value={m.brochure.headline} onChange={(e) => patch({ brochure: { ...m.brochure, headline: e.target.value } })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Subhead</label>
              <input value={m.brochure.subhead} onChange={(e) => patch({ brochure: { ...m.brochure, subhead: e.target.value } })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Body</label>
              <textarea value={m.brochure.body} rows={5} onChange={(e) => patch({ brochure: { ...m.brochure, body: e.target.value } })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Highlights <span className="text-[var(--text-muted)]">(one per line)</span></label>
              <textarea
                value={m.brochure.highlights.join("\n")}
                rows={4}
                onChange={(e) => patch({ brochure: { ...m.brochure, highlights: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) } })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Call to action</label>
              <input value={m.brochure.cta} onChange={(e) => patch({ brochure: { ...m.brochure, cta: e.target.value } })} className={inputCls} />
            </div>
          </div>
        )}

        {tab === "email" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={labelCls}>Subject</label>
              <CopyButton text={m.email.subject} />
            </div>
            <input value={m.email.subject} onChange={(e) => patch({ email: { ...m.email, subject: e.target.value } })} className={inputCls} />
            <div>
              <label className={labelCls}>Preheader</label>
              <input value={m.email.preheader} onChange={(e) => patch({ email: { ...m.email, preheader: e.target.value } })} className={inputCls} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className={labelCls}>Body</label>
                <CopyButton text={m.email.body} />
              </div>
              <textarea value={m.email.body} rows={9} onChange={(e) => patch({ email: { ...m.email, body: e.target.value } })} className={inputCls} />
            </div>
          </div>
        )}

        {tab === "social" && (
          <div className="space-y-4">
            {(["linkedin", "facebook", "instagram"] as const).map((net) => (
              <div key={net}>
                <div className="flex items-center justify-between">
                  <label className={`${labelCls} capitalize`}>{net}</label>
                  <CopyButton text={m.social[net]} />
                </div>
                <textarea
                  value={m.social[net]}
                  rows={net === "instagram" ? 3 : 4}
                  onChange={(e) => patch({ social: { ...m.social, [net]: e.target.value } })}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-rose-700">{error}</p>}
      <p className="mt-4 text-xs text-[var(--text-muted)]">
        Educational community event — copy must not solicit securities or imply investment outcomes.
      </p>
    </section>
  );
}
