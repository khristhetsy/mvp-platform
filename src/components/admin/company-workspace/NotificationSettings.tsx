"use client";

import { useEffect, useState } from "react";

type EventPref = { in_app: boolean; email: boolean; digest: boolean };

type DigestFrequency = "daily" | "weekly" | "off";

type NotificationPrefs = {
  events: Record<string, EventPref>;
  digest_frequency: DigestFrequency;
  quiet_start: string | null;
  quiet_end: string | null;
  timezone: string | null;
  pause_all: boolean;
  critical_override: boolean;
  channel_in_app: boolean;
  channel_email: boolean;
  channel_slack: boolean;
};

// Curated common IANA zones for the dropdown; the saved/detected zone is
// prepended if it isn't already in the list.
const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Madrid",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** e.g. "America/New_York (GMT-4)". */
function tzOffsetLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date());
    const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return name ? `${tz} (${name})` : tz;
  } catch {
    return tz;
  }
}

/** "20:00" → "8:00 PM". */
function to12h(hhmm: string | null): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

const EVENT_META: ReadonlyArray<{ key: string; label: string; description: string }> = [
  { key: "new_founder_signup", label: "New founder signup", description: "A founder completes signup" },
  { key: "stage_approval_request", label: "Stage approval request", description: "Founder requests to advance a stage" },
  { key: "compliance_escalation", label: "Compliance escalation", description: "New high/critical compliance event" },
  { key: "remediation_overdue", label: "Remediation overdue", description: "A remediation task passes its due date" },
  { key: "investor_interest", label: "Investor interest logged", description: "An investor expresses interest" },
  { key: "intro_request", label: "Intro request", description: "An investor requests a warm intro" },
  { key: "spv_blocker", label: "SPV blocker", description: "An SPV item needs operational attention" },
  { key: "document_uploaded", label: "Document uploaded", description: "Founder uploads a data-room document" },
  { key: "readiness_rescored", label: "Readiness re-scored", description: "A company's readiness score changes" },
  { key: "strong_investor_match", label: "Strong investor match", description: "A company strongly matches an investor (70%+)" },
];

const DEFAULT_PREFS: NotificationPrefs = {
  events: {
    new_founder_signup: { in_app: true, email: true, digest: true },
    stage_approval_request: { in_app: true, email: true, digest: false },
    compliance_escalation: { in_app: true, email: true, digest: false },
    remediation_overdue: { in_app: true, email: false, digest: true },
    investor_interest: { in_app: true, email: true, digest: false },
    intro_request: { in_app: true, email: true, digest: false },
    spv_blocker: { in_app: true, email: true, digest: false },
    document_uploaded: { in_app: true, email: false, digest: true },
    readiness_rescored: { in_app: false, email: false, digest: true },
    strong_investor_match: { in_app: true, email: true, digest: false },
  },
  digest_frequency: "weekly",
  quiet_start: "20:00",
  quiet_end: "07:00",
  timezone: null,
  pause_all: false,
  critical_override: true,
  channel_in_app: true,
  channel_email: true,
  channel_slack: false,
};

function eventPrefFor(prefs: NotificationPrefs, key: string): EventPref {
  return prefs.events[key] ?? { in_app: false, email: false, digest: false };
}

function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-blue-600" : "bg-slate-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/notification-preferences");
        if (!res.ok) throw new Error("Failed to load preferences.");
        const data = (await res.json()) as NotificationPrefs;
        // Default the zone to the viewer's browser zone on first visit so quiet
        // hours are interpreted locally out of the box.
        if (active) setPrefs({ ...data, timezone: data.timezone ?? detectBrowserTimezone() });
      } catch {
        if (active) {
          setPrefs(DEFAULT_PREFS);
          setError("Could not load your saved preferences — showing defaults.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function update(patch: Partial<NotificationPrefs>) {
    setPrefs((prev) => (prev ? { ...prev, ...patch } : prev));
    setSaved(false);
  }

  function updateEvent(key: string, channel: keyof EventPref, value: boolean) {
    setPrefs((prev) => {
      if (!prev) return prev;
      const current = eventPrefFor(prev, key);
      return { ...prev, events: { ...prev.events, [key]: { ...current, [channel]: value } } };
    });
    setSaved(false);
  }

  async function handleSave() {
    if (!prefs) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error("Save failed.");
      const data = (await res.json()) as NotificationPrefs;
      setPrefs(data);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Could not save your preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setPrefs(DEFAULT_PREFS);
    setSaved(false);
  }

  if (loading || !prefs) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
        <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {/* Event notifications */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Event notifications</h3>
        <p className="mt-1 text-sm text-slate-500">Choose how you are notified for each type of event.</p>

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <div className="hidden grid-cols-[1fr_5rem_5rem_5rem] items-center gap-2 bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 sm:grid">
            <span>Event</span>
            <span className="text-center">In-app</span>
            <span className="text-center">Email</span>
            <span className="text-center">Digest</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {EVENT_META.map((meta) => {
              const pref = eventPrefFor(prefs, meta.key);
              return (
                <li
                  key={meta.key}
                  className="grid grid-cols-[1fr_5rem_5rem_5rem] items-center gap-2 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{meta.label}</p>
                    <p className="text-xs text-slate-500">{meta.description}</p>
                  </div>
                  <div className="flex justify-center">
                    <Toggle
                      checked={pref.in_app}
                      onChange={(v) => updateEvent(meta.key, "in_app", v)}
                      label={`${meta.label} in-app`}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Toggle
                      checked={pref.email}
                      onChange={(v) => updateEvent(meta.key, "email", v)}
                      label={`${meta.label} email`}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Toggle
                      checked={pref.digest}
                      onChange={(v) => updateEvent(meta.key, "digest", v)}
                      label={`${meta.label} digest`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Delivery */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Delivery</h3>
        <p className="mt-1 text-sm text-slate-500">Control digest cadence and when notifications are muted.</p>

        <div className="mt-4 space-y-5">
          <div className="flex flex-col gap-1">
            <label htmlFor="digest_frequency" className="text-sm font-medium text-slate-700">
              Digest frequency
            </label>
            <select
              id="digest_frequency"
              value={prefs.digest_frequency}
              onChange={(e) => update({ digest_frequency: e.target.value as DigestFrequency })}
              className="w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="off">Off</option>
            </select>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="quiet_start" className="text-sm font-medium text-slate-700">
                Quiet hours start
              </label>
              <input
                id="quiet_start"
                type="time"
                value={prefs.quiet_start ?? ""}
                onChange={(e) => update({ quiet_start: e.target.value || null })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="quiet_end" className="text-sm font-medium text-slate-700">
                Quiet hours end
              </label>
              <input
                id="quiet_end"
                type="time"
                value={prefs.quiet_end ?? ""}
                onChange={(e) => update({ quiet_end: e.target.value || null })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Time zone — quiet hours are evaluated in this zone. */}
          <div className="flex flex-col gap-1">
            <label htmlFor="timezone" className="text-sm font-medium text-slate-700">
              Time zone
            </label>
            <select
              id="timezone"
              value={prefs.timezone ?? "UTC"}
              onChange={(e) => update({ timezone: e.target.value })}
              className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {(prefs.timezone && !COMMON_TIMEZONES.includes(prefs.timezone)
                ? [prefs.timezone, ...COMMON_TIMEZONES]
                : COMMON_TIMEZONES
              ).map((tz) => (
                <option key={tz} value={tz}>{tzOffsetLabel(tz)}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => update({ timezone: detectBrowserTimezone() })}
              className="mt-1 self-start text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              📍 Use my current zone ({detectBrowserTimezone()})
            </button>
          </div>

          {prefs.quiet_start && prefs.quiet_end ? (
            <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-[13px] text-blue-900">
              <span aria-hidden="true">🕗</span>
              <span>
                Notifications are muted <b>{to12h(prefs.quiet_start)} → {to12h(prefs.quiet_end)}</b> in{" "}
                <b>{tzOffsetLabel(prefs.timezone ?? "UTC")}</b>. The times above are interpreted in this zone.
              </span>
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Pause all notifications</p>
              <p className="text-xs text-slate-500">Temporarily stop every non-critical notification.</p>
            </div>
            <Toggle
              checked={prefs.pause_all}
              onChange={(v) => update({ pause_all: v })}
              label="Pause all notifications"
            />
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Always deliver critical alerts</p>
              <p className="text-xs text-slate-500">Override quiet hours and pause for critical events.</p>
            </div>
            <Toggle
              checked={prefs.critical_override}
              onChange={(v) => update({ critical_override: v })}
              label="Always deliver critical alerts"
            />
          </div>
        </div>
      </section>

      {/* Channels */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Channels</h3>
        <p className="mt-1 text-sm text-slate-500">Enable or disable delivery channels globally.</p>

        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">In-app</p>
              <p className="text-xs text-slate-500">Show notifications inside the workspace.</p>
            </div>
            <Toggle
              checked={prefs.channel_in_app}
              onChange={(v) => update({ channel_in_app: v })}
              label="In-app channel"
            />
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Email</p>
              <p className="text-xs text-slate-500">Send notifications to your email address.</p>
            </div>
            <Toggle
              checked={prefs.channel_email}
              onChange={(v) => update({ channel_email: v })}
              label="Email channel"
            />
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Slack</p>
              <p className="text-xs text-slate-500">Post notifications to your connected Slack.</p>
            </div>
            <Toggle
              checked={prefs.channel_slack}
              onChange={(v) => update({ channel_slack: v })}
              label="Slack channel"
            />
          </div>
        </div>
      </section>

      {/* Save bar */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        {saved && <span className="text-sm font-medium text-green-600">Saved</span>}
        <button
          type="button"
          onClick={handleReset}
          disabled={saving}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset to defaults
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

export default NotificationSettings;
