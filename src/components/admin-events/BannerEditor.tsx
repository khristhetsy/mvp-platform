"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Bold, Italic, Underline, Link2, List, AlignLeft, AlignCenter } from "lucide-react";
import type { EventRecord } from "@/lib/icfo-events/types";

const BG_OPTIONS: { value: string; labelKey: string; swatch: string }[] = [
  { value: "indigo", labelKey: "bg_indigo", swatch: "#EEEDFE" },
  { value: "teal", labelKey: "bg_teal", swatch: "#E1F5EE" },
  { value: "navy", labelKey: "bg_navy", swatch: "#0f2147" },
  { value: "plain", labelKey: "bg_plain", swatch: "#ffffff" },
];

function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

export function BannerEditor({ event }: { event: EventRecord }) {
  const t = useTranslations("adminCmp");
  const bodyRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState(event.bannerTitle ?? "");
  const [bg, setBg] = useState(event.bannerBg ?? "indigo");
  const [showCountdown, setShowCountdown] = useState(event.showCountdown);
  const [orgName, setOrgName] = useState(event.organizerName ?? "");
  const [orgPhone, setOrgPhone] = useState(event.organizerPhone ?? "");
  const [orgEmail, setOrgEmail] = useState(event.organizerEmail ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bannerTitle: title || null,
          bannerHtml: bodyRef.current?.innerHTML ?? "",
          bannerBg: bg,
          showCountdown,
          organizerName: orgName || null,
          organizerPhone: orgPhone || null,
          organizerEmail: orgEmail || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : t("saving"));
      setMsg(t("saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const toolbarBtn = "rounded p-1.5 text-[var(--text-secondary)] hover:bg-slate-100";

  return (
    <section className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
      <h2 className="font-semibold text-[var(--navy)]">{t("banner_editor_title")}</h2>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{t("banner_editor_desc")}</p>

      <label className="mt-4 block">
        <span className="text-xs font-medium text-[var(--text-muted)]">{t("banner_heading_label")}</span>
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setMsg(null); }}
          maxLength={160}
          className="mt-1 block w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
        />
      </label>

      <div className="mt-4">
        <span className="text-xs font-medium text-[var(--text-muted)]">{t("banner_body_label")}</span>
        <div className="mt-1 overflow-hidden rounded-md border border-[var(--border-subtle)]">
          <div className="flex items-center gap-0.5 border-b border-[var(--border-subtle)] bg-slate-50 px-2 py-1">
            <button type="button" aria-label={t("fmt_bold")} className={toolbarBtn} onClick={() => exec("bold")}><Bold className="h-4 w-4" /></button>
            <button type="button" aria-label={t("fmt_italic")} className={toolbarBtn} onClick={() => exec("italic")}><Italic className="h-4 w-4" /></button>
            <button type="button" aria-label={t("fmt_underline")} className={toolbarBtn} onClick={() => exec("underline")}><Underline className="h-4 w-4" /></button>
            <span className="mx-1 h-4 w-px bg-[var(--border-subtle)]" />
            <button type="button" aria-label={t("fmt_align_left")} className={toolbarBtn} onClick={() => exec("justifyLeft")}><AlignLeft className="h-4 w-4" /></button>
            <button type="button" aria-label={t("fmt_align_center")} className={toolbarBtn} onClick={() => exec("justifyCenter")}><AlignCenter className="h-4 w-4" /></button>
            <button type="button" aria-label={t("fmt_bullet")} className={toolbarBtn} onClick={() => exec("insertUnorderedList")}><List className="h-4 w-4" /></button>
            <button
              type="button"
              aria-label={t("fmt_link")}
              className={toolbarBtn}
              onClick={() => {
                const url = window.prompt(t("fmt_link"));
                if (url) exec("createLink", url);
              }}
            >
              <Link2 className="h-4 w-4" />
            </button>
          </div>
          <div
            ref={bodyRef}
            contentEditable
            suppressContentEditableWarning
            className="min-h-[100px] px-3 py-2 text-sm text-[var(--navy)] focus:outline-none [&_a]:text-[var(--blue)] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: event.bannerHtml ?? "" }}
            onInput={() => setMsg(null)}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-[var(--text-muted)]">{t("banner_bg_label")}</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {BG_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { setBg(o.value); setMsg(null); }}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${
                  bg === o.value ? "border-[var(--indigo)] bg-[var(--indigo-soft)] text-[var(--indigo)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                }`}
              >
                <span className="h-3.5 w-3.5 rounded border border-[var(--border-subtle)]" style={{ background: o.swatch }} />
                {t(o.labelKey)}
              </button>
            ))}
          </div>
        </label>

        <label className="flex items-center gap-2 self-end">
          <input type="checkbox" checked={showCountdown} onChange={(e) => { setShowCountdown(e.target.checked); setMsg(null); }} />
          <span className="text-sm text-[var(--text-secondary)]">{t("show_countdown_label")}</span>
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-[var(--text-muted)]">{t("organizer_name_label")}</span>
          <input value={orgName} onChange={(e) => { setOrgName(e.target.value); setMsg(null); }} maxLength={160} className="mt-1 block w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--text-muted)]">{t("organizer_phone_label")}</span>
          <input value={orgPhone} onChange={(e) => { setOrgPhone(e.target.value); setMsg(null); }} maxLength={60} className="mt-1 block w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--text-muted)]">{t("organizer_email_label")}</span>
          <input value={orgEmail} onChange={(e) => { setOrgEmail(e.target.value); setMsg(null); }} maxLength={200} className="mt-1 block w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
        </label>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3 border-t border-[var(--border-subtle)] pt-4">
        {msg && <span className="text-sm font-medium text-emerald-700">{msg}</span>}
        {error && <span className="text-sm text-rose-600">{error}</span>}
        <button onClick={save} disabled={saving} className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
          {saving ? t("saving") : t("save_banner")}
        </button>
      </div>
    </section>
  );
}
