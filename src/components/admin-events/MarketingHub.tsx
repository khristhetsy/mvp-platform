"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Copy, Check } from "lucide-react";
import type { EventMarketing } from "@/lib/icfo-events/marketing";

type Tab = "seo" | "brochure" | "email" | "social";
const TAB_KEYS: { key: Tab; labelKey: string }[] = [
  { key: "seo", labelKey: "tabSeo" },
  { key: "brochure", labelKey: "tabBrochure" },
  { key: "email", labelKey: "tabEmail" },
  { key: "social", labelKey: "tabSocial" },
];

const labelCls = "mb-1 block text-xs font-medium text-[var(--text-secondary)]";
const inputCls = "w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm";

function CopyButton({ text }: { text: string }) {
  const t = useTranslations("eventsAdmin.marketing");
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
      {done ? t("copied") : t("copy")}
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
  const t = useTranslations("eventsAdmin.marketing");
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
          <h2 className="font-semibold text-[var(--navy)]">{t("title")}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {t("descPre")}<span className="font-medium text-[var(--navy)]">{eventTitle}</span>{t("descPost")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-amber-600">{t("unsaved")}</span>}
          {!dirty && savedAt && <span className="text-xs text-[var(--text-muted)]">{t("saved", { when: new Date(savedAt).toLocaleString() })}</span>}
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? t("saving") : t("saveKit")}
          </button>
        </div>
      </div>

      {/* AI campaign kit */}
      <div className="mt-4 rounded-lg border border-[var(--indigo)] bg-[var(--indigo-soft)] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--indigo)]" />
          <span className="text-sm font-medium text-[var(--navy)]">{t("aiKit")}</span>
          <input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder={t("tonePlaceholder")}
            className="ml-auto w-48 rounded-md border border-[var(--border-subtle)] bg-white px-2.5 py-1.5 text-xs"
          />
          <button
            onClick={generate}
            disabled={generating}
            className="rounded-md bg-[var(--indigo)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {generating ? t("drafting") : t("generateAll")}
          </button>
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {claudeConfigured ? t("aiNoteConfigured") : t("aiNoteFallback")}
        </p>
      </div>

      {/* tabs */}
      <div className="mt-4 flex gap-1 border-b border-[var(--border-subtle)]">
        {TAB_KEYS.map((tab_) => (
          <button
            key={tab_.key}
            onClick={() => setTab(tab_.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === tab_.key ? "border-[var(--indigo)] text-[var(--indigo)]" : "border-transparent text-[var(--text-secondary)]"
            }`}
          >
            {t(tab_.labelKey)}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "seo" && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>{t("seoTitle")} <span className="text-[var(--text-muted)]">({m.seoTitle.length}/60)</span></label>
              <input value={m.seoTitle} maxLength={120} onChange={(e) => patch({ seoTitle: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("metaDescription")} <span className="text-[var(--text-muted)]">({m.seoDescription.length}/160)</span></label>
              <textarea value={m.seoDescription} maxLength={320} rows={3} onChange={(e) => patch({ seoDescription: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("keywords")}</label>
              <input value={m.seoKeywords} maxLength={500} onChange={(e) => patch({ seoKeywords: e.target.value })} className={inputCls} placeholder={t("keywordsPlaceholder")} />
            </div>
          </div>
        )}

        {tab === "brochure" && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>{t("headline")}</label>
              <input value={m.brochure.headline} onChange={(e) => patch({ brochure: { ...m.brochure, headline: e.target.value } })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("subhead")}</label>
              <input value={m.brochure.subhead} onChange={(e) => patch({ brochure: { ...m.brochure, subhead: e.target.value } })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("body")}</label>
              <textarea value={m.brochure.body} rows={5} onChange={(e) => patch({ brochure: { ...m.brochure, body: e.target.value } })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("highlights")} <span className="text-[var(--text-muted)]">{t("highlightsHint")}</span></label>
              <textarea
                value={m.brochure.highlights.join("\n")}
                rows={4}
                onChange={(e) => patch({ brochure: { ...m.brochure, highlights: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) } })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t("cta")}</label>
              <input value={m.brochure.cta} onChange={(e) => patch({ brochure: { ...m.brochure, cta: e.target.value } })} className={inputCls} />
            </div>
          </div>
        )}

        {tab === "email" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={labelCls}>{t("subject")}</label>
              <CopyButton text={m.email.subject} />
            </div>
            <input value={m.email.subject} onChange={(e) => patch({ email: { ...m.email, subject: e.target.value } })} className={inputCls} />
            <div>
              <label className={labelCls}>{t("preheader")}</label>
              <input value={m.email.preheader} onChange={(e) => patch({ email: { ...m.email, preheader: e.target.value } })} className={inputCls} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className={labelCls}>{t("body")}</label>
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
      <p className="mt-4 text-xs text-[var(--text-muted)]">{t("compliance")}</p>
    </section>
  );
}
