"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cadenceLabel, cadenceOptions, DIGEST_TIMES, TIMEZONES } from "./cadence-options";

type Channel = "in_app" | "email" | "push";
type CatalogItem = {
  id: string; group: string; label: string; description: string;
  kind: "alert" | "reminder"; supportsCadence: boolean; urgent: boolean;
  defaultCadence: string | null; preview: { title: string; body: string } | null;
};
type PrefRow = { id: string; enabled: boolean; channels: Channel[]; cadence: string | null; isOverride: boolean };
type Settings = {
  master_on: boolean; quiet_hours_on: boolean; quiet_start: string; quiet_end: string;
  digest_time: string; default_channels: Channel[]; timezone: string;
};
type Loaded = {
  groups: { id: string; label: string }[];
  channels: Channel[];
  catalog: CatalogItem[];
  settings: Settings;
  prefs: PrefRow[];
};

const PURPLE = "#2E78F5";
const CHANNEL_LABEL: Record<Channel, string> = { in_app: "In-app", email: "Email", push: "Push" };
const PUSH_ENABLED = false;

const card: React.CSSProperties = {
  background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12,
  boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)",
};

function Switch({ on, disabled, onToggle, label }: { on: boolean; disabled?: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      onClick={onToggle}
      style={{
        width: 38, height: 22, borderRadius: 999, border: "none", cursor: disabled ? "not-allowed" : "pointer",
        background: on ? PURPLE : "#cbd2dd", padding: 2, transition: "background .15s", opacity: disabled ? 0.5 : 1,
        display: "inline-flex", alignItems: "center",
      }}
    >
      <span style={{
        width: 18, height: 18, borderRadius: "50%", background: "#fff",
        transform: on ? "translateX(16px)" : "translateX(0)", transition: "transform .15s",
        boxShadow: "0 1px 2px rgb(0 0 0 / 0.2)",
      }} />
    </button>
  );
}

function ChannelChips({
  value, onChange, disabled,
}: { value: Channel[]; onChange: (c: Channel[]) => void; disabled?: boolean }) {
  const all: Channel[] = ["in_app", "email", "push"];
  const toggle = (c: Channel) => {
    if (disabled) return;
    onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
  };
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {all.map((c) => {
        const active = value.includes(c);
        const isPush = c === "push";
        const chipDisabled = disabled || (isPush && !PUSH_ENABLED);
        return (
          <button
            key={c} type="button" onClick={() => toggle(c)} disabled={chipDisabled}
            aria-pressed={active}
            title={isPush && !PUSH_ENABLED ? "Push — coming soon" : CHANNEL_LABEL[c]}
            style={{
              fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 999,
              border: active ? `1px solid ${PURPLE}` : "1px solid #d7dce4",
              background: active ? "#EEEDFE" : "#fff", color: active ? PURPLE : "#5f5e5a",
              cursor: chipDisabled ? "not-allowed" : "pointer", opacity: chipDisabled ? 0.55 : 1, whiteSpace: "nowrap",
            }}
          >
            {CHANNEL_LABEL[c]}{isPush && !PUSH_ENABLED ? " · soon" : ""}
          </button>
        );
      })}
    </div>
  );
}

export function NotificationsSettings() {
  const t = useTranslations("sharedCmp");
  const [data, setData] = useState<Loaded | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [prefs, setPrefs] = useState<Record<string, PrefRow>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/marketing/notifications/prefs");
      const d: Loaded = await res.json();
      if (!res.ok) throw new Error("Failed to load.");
      setData(d);
      setSettings(d.settings);
      setPrefs(Object.fromEntries(d.prefs.map((p) => [p.id, p])));
      setDirty(false);
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Failed to load.", ok: false });
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const updatePref = (id: string, patch: Partial<PrefRow>) => {
    setPrefs((prev) => ({ ...prev, [id]: { ...prev[id], ...patch, id } }));
    setDirty(true);
  };
  const updateSettings = (patch: Partial<Settings>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setMsg(null);
    try {
      const body = {
        prefs: Object.values(prefs).map((p) => ({ type_id: p.id, enabled: p.enabled, channels: p.channels, cadence: p.cadence })),
        settings,
      };
      const res = await fetch("/api/admin/marketing/notifications/prefs", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(typeof e.error === "string" ? e.error : "Save failed.");
      }
      setMsg({ text: "Settings saved.", ok: true });
      setDirty(false);
      setTimeout(() => setMsg(null), 2500);
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Save failed.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  const previews = useMemo(() => {
    if (!data || !settings) return [];
    if (!settings.master_on) return [];
    return data.catalog
      .filter((t) => t.preview && (prefs[t.id]?.enabled ?? true))
      .slice(0, 4)
      .map((t) => ({ id: t.id, kind: t.kind, ...t.preview! }));
  }, [data, prefs, settings]);

  if (loading || !data || !settings) {
    return <p style={{ fontSize: 13, color: "#5f5e5a", padding: 24 }}>{t("loading_notification_settings")}</p>;
  }

  const groupCount = (gid: string) => {
    const items = data.catalog.filter((t) => t.group === gid);
    const on = items.filter((t) => prefs[t.id]?.enabled ?? true).length;
    return { on, total: items.length };
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 20, alignItems: "start" }}>
      {/* Left: grouped list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {!settings.master_on ? (
          <div style={{ ...card, padding: "10px 14px", background: "#FAEEDA", border: "0.5px solid #EDD8AE", color: "#854F0B", fontSize: 12.5 }}>
            Master switch is off — all notifications are muted. Turn it on to deliver alerts and reminders.
          </div>
        ) : null}

        {data.groups.map((g) => {
          const items = data.catalog.filter((t) => t.group === g.id);
          const c = groupCount(g.id);
          return (
            <div key={g.id} style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid #eef1f5" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0f2147" }}>{g.label}</span>
                <span style={{ fontSize: 11, color: "#7a8494", fontFamily: "var(--font-mono, monospace)" }}>{c.on}/{c.total} on</span>
              </div>
              <div>
                {items.map((t, i) => {
                  const p = prefs[t.id] ?? { id: t.id, enabled: true, channels: [] as Channel[], cadence: t.defaultCadence, isOverride: false };
                  const off = !p.enabled;
                  return (
                    <div key={t.id} style={{
                      display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px",
                      borderTop: i === 0 ? "none" : "0.5px solid #f2f4f7", opacity: off ? 0.55 : 1,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#0f2147" }}>{t.label}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em",
                            padding: "1px 6px", borderRadius: 4,
                            background: t.kind === "alert" ? "#E6F1FB" : "#E1F5EE",
                            color: t.kind === "alert" ? "#185FA5" : "#0F6E56",
                          }}>{t.kind}</span>
                          {t.urgent ? (
                            <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", padding: "1px 6px", borderRadius: 4, background: "#FCEBEB", color: "#A32D2D" }}>urgent</span>
                          ) : null}
                        </div>
                        <p style={{ fontSize: 12, color: "#6b7280", margin: "3px 0 0" }}>{t.description}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                          {t.supportsCadence ? (
                            <select
                              value={p.cadence ?? t.defaultCadence ?? ""}
                              disabled={off}
                              onChange={(e) => updatePref(t.id, { cadence: e.target.value })}
                              aria-label={`${t.label} cadence`}
                              style={{ fontSize: 11.5, padding: "3px 6px", borderRadius: 6, border: "1px solid #d7dce4", background: "#fff", color: "#3d3d3a" }}
                            >
                              {cadenceOptions(t.defaultCadence).map((tok) => (
                                <option key={tok} value={tok}>{cadenceLabel(tok)}</option>
                              ))}
                            </select>
                          ) : null}
                          <ChannelChips value={p.channels} disabled={off} onChange={(ch) => updatePref(t.id, { channels: ch })} />
                        </div>
                      </div>
                      <div style={{ paddingTop: 2 }}>
                        <Switch on={p.enabled} label={`${t.label} on/off`} onToggle={() => updatePref(t.id, { enabled: !p.enabled })} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Right: master control + live preview */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 12 }}>
        <div style={card}>
          <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #eef1f5", fontSize: 13, fontWeight: 600, color: "#0f2147" }}>{t("controls")}</div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <Row label={t("master_switch")} hint="Mutes everything when off">
              <Switch on={settings.master_on} label={t("master_switch")} onToggle={() => updateSettings({ master_on: !settings.master_on })} />
            </Row>
            <Row label={t("digest_time")} hint="When the morning brief fires">
              <select value={settings.digest_time} onChange={(e) => updateSettings({ digest_time: e.target.value })}
                style={selectStyle} aria-label="Digest time">
                {DIGEST_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Row>
            <Row label={t("quiet_hours")} hint="Holds non-urgent email/push">
              <Switch on={settings.quiet_hours_on} label={t("quiet_hours")} onToggle={() => updateSettings({ quiet_hours_on: !settings.quiet_hours_on })} />
            </Row>
            {settings.quiet_hours_on ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 2 }}>
                <input type="time" value={settings.quiet_start} onChange={(e) => updateSettings({ quiet_start: e.target.value })} style={selectStyle} aria-label="Quiet start" />
                <span style={{ fontSize: 12, color: "#7a8494" }}>to</span>
                <input type="time" value={settings.quiet_end} onChange={(e) => updateSettings({ quiet_end: e.target.value })} style={selectStyle} aria-label="Quiet end" />
              </div>
            ) : null}
            <div>
              <p style={{ fontSize: 12.5, fontWeight: 500, color: "#0f2147", margin: "0 0 6px" }}>{t("default_channels")}</p>
              <ChannelChips value={settings.default_channels} onChange={(ch) => updateSettings({ default_channels: ch })} />
            </div>
            <Row label={t("timezone")} hint="">
              <select value={settings.timezone} onChange={(e) => updateSettings({ timezone: e.target.value })} style={selectStyle} aria-label="Timezone">
                {(TIMEZONES.includes(settings.timezone) ? TIMEZONES : [settings.timezone, ...TIMEZONES]).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Row>
          </div>
        </div>

        <div style={card}>
          <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #eef1f5", fontSize: 13, fontWeight: 600, color: "#0f2147" }}>{t("live_preview")}</div>
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {previews.length === 0 ? (
              <p style={{ fontSize: 12, color: "#7a8494", padding: 4 }}>{t("nothing_enabled_to_preview")}</p>
            ) : previews.map((p) => (
              <div key={p.id} style={{ border: "0.5px solid #eef1f5", borderRadius: 8, padding: "8px 10px", background: "#fbfbfd" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.kind === "alert" ? "#185FA5" : "#0F6E56", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#0f2147" }}>{p.title}</span>
                </div>
                <p style={{ fontSize: 11.5, color: "#6b7280", margin: "3px 0 0", lineHeight: 1.4 }}>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky action bar */}
      <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 12, position: "sticky", bottom: 0, background: "var(--background)", paddingTop: 8 }}>
        <button type="button" onClick={() => void save()} disabled={saving || !dirty}
          style={{ background: dirty ? PURPLE : "#c9cdd6", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: dirty && !saving ? "pointer" : "not-allowed" }}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={() => void load()} disabled={saving}
          style={{ background: "#fff", color: "#3d3d3a", border: "0.5px solid #d7dce4", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          Reset
        </button>
        {msg ? <span style={{ fontSize: 12.5, color: msg.ok ? "#0F6E56" : "#A32D2D" }}>{msg.text}</span> : null}
        {dirty && !msg ? <span style={{ fontSize: 12.5, color: "#854F0B" }}>{t("unsaved_changes")}</span> : null}
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid #d7dce4", background: "#fff", color: "#3d3d3a",
};

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div>
        <p style={{ fontSize: 12.5, fontWeight: 500, color: "#0f2147", margin: 0 }}>{label}</p>
        {hint ? <p style={{ fontSize: 11, color: "#7a8494", margin: "1px 0 0" }}>{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}
