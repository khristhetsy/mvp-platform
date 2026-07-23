"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarPlus, Globe, Phone, Mail, Linkedin, Twitter, Link2, Check } from "lucide-react";

function toUtcStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function googleCalUrl(title: string, startsAt: string | null, endsAt: string | null, details: string): string {
  const p = new URLSearchParams({ action: "TEMPLATE", text: title, details, location: "Online event" });
  if (startsAt) {
    const end = endsAt ?? new Date(new Date(startsAt).getTime() + 2 * 3600_000).toISOString();
    p.set("dates", `${toUtcStamp(startsAt)}/${toUtcStamp(end)}`);
  }
  return `https://www.google.com/calendar/render?${p.toString()}`;
}

function icsHref(title: string, startsAt: string | null, endsAt: string | null, url: string): string {
  const end = endsAt ?? (startsAt ? new Date(new Date(startsAt).getTime() + 2 * 3600_000).toISOString() : null);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODIN:-//iCapOS//Events//EN",
    "BEGIN:VEVENT",
    `SUMMARY:${title}`,
    startsAt ? `DTSTART:${toUtcStamp(startsAt)}` : "",
    end ? `DTEND:${toUtcStamp(end)}` : "",
    `URL:${url}`,
    "LOCATION:Online event",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

export function EventSideRail({
  title,
  startsAt,
  endsAt,
  timezone,
  formatLabel,
  organizerName,
  organizerPhone,
  organizerEmail,
  alreadyRegistered,
  ended,
}: {
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  timezone?: string | null;
  formatLabel: string;
  organizerName: string | null;
  organizerPhone: string | null;
  organizerEmail: string | null;
  alreadyRegistered: boolean;
  ended: boolean;
}) {
  const t = useTranslations("appPages");
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const start = startsAt ? new Date(startsAt) : null;
  const tz = timezone ?? undefined;
  const tzAbbrev =
    timezone && start
      ? new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "short" })
          .formatToParts(start)
          .find((p) => p.type === "timeZoneName")?.value ?? null
      : null;

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-4">
      {!ended && (
        <div
          className={`rounded-md px-3 py-2 text-xs font-medium ${
            alreadyRegistered ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {alreadyRegistered ? `✓ ${t("youre_registered")}` : t("free_registration")}
        </div>
      )}

      {start && (
        <div className="mt-4 flex items-center gap-3">
          <div className="text-center leading-none">
            <div className="text-2xl font-semibold text-[var(--navy)]">
              {new Intl.DateTimeFormat(undefined, { timeZone: tz, day: "numeric" }).format(start)}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              {start.toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: tz })}
            </div>
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: tz })}
            {endsAt && <> → {new Date(endsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: tz })}</>}
            {tzAbbrev && <span className="ml-1.5 font-medium text-[var(--navy)]">{tzAbbrev}</span>}
          </div>
        </div>
      )}

      {start && (
        <div className="mt-3">
          <div className="text-[11px] text-[var(--text-muted)]">{t("add_to_calendar")}</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <a
              href={googleCalUrl(title, startsAt, endsAt, shareUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:bg-slate-50"
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Google
            </a>
            <a
              href={icsHref(title, startsAt, endsAt, shareUrl)}
              download={`${title.slice(0, 40)}.ics`}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:bg-slate-50"
            >
              <CalendarPlus className="h-3.5 w-3.5" /> {t("calendar_ics")}
            </a>
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
        <div className="text-[11px] text-[var(--text-muted)]">{t("location")}</div>
        <div className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-[var(--navy)]">
          <Globe className="h-3.5 w-3.5" /> {formatLabel}
        </div>
      </div>

      {(organizerName || organizerPhone || organizerEmail) && (
        <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
          <div className="text-[11px] text-[var(--text-muted)]">{t("organizer")}</div>
          {organizerName && <div className="text-sm font-medium text-[var(--navy)]">{organizerName}</div>}
          {organizerPhone && (
            <a href={`tel:${organizerPhone}`} className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:underline">
              <Phone className="h-3 w-3" /> {organizerPhone}
            </a>
          )}
          {organizerEmail && (
            <a href={`mailto:${organizerEmail}`} className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:underline">
              <Mail className="h-3 w-3" /> {organizerEmail}
            </a>
          )}
        </div>
      )}

      <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
        <div className="mb-1.5 text-[11px] text-[var(--text-muted)]">{t("share")}</div>
        <div className="flex items-center gap-3 text-[var(--text-secondary)]">
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="hover:text-[var(--blue)]"
          >
            <Linkedin className="h-4 w-4" />
          </a>
          <a
            href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(title)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X"
            className="hover:text-[var(--blue)]"
          >
            <Twitter className="h-4 w-4" />
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shareUrl)}`}
            aria-label="Email"
            className="hover:text-[var(--blue)]"
          >
            <Mail className="h-4 w-4" />
          </a>
          <button onClick={copyLink} aria-label={t("share")} className="hover:text-[var(--blue)]">
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
