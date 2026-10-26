"use client";

// Step 1 for a subscription package: the six parts, and the subscriber profile
// that decides which documents each part holds (see lib/contracts/subscription/package.ts).
// The documents are only made when "Open editor" is pressed.

import { COMMUNITY_PROPERTY_STATES, PARTS, packageItems, spouseNote, type PackageItem, type SubscriberProfile } from "@/lib/contracts/subscription/package";
import { BLUE, btn, MUTED, NAVY, Notice } from "./ui";

export type PickerTemplate = { id: string; key: string; name: string; version: number; usage: number; versions: number };

const sub = { fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8a93a6", marginBottom: 8 } as const;
const link = { border: "none", background: "none", padding: 0, fontSize: 11, color: BLUE, cursor: "pointer" } as const;

export function SubscriptionPackagePicker({
  templates,
  isAdmin,
  profile,
  onProfile,
  busy,
  missingMasters,
  onInstall,
  onReplace,
  onHistory,
  onOpen,
  openLabel,
}: {
  templates: PickerTemplate[];
  isAdmin: boolean;
  profile: SubscriberProfile;
  onProfile: (p: SubscriberProfile) => void;
  busy: boolean;
  missingMasters: number;
  onInstall: () => void;
  onReplace: (templateId: string) => void;
  onHistory: (templateId: string) => void;
  onOpen: () => void;
  openLabel: string;
}) {
  const items = packageItems(profile);
  const byKey = new Map(templates.map((t) => [t.key, t]));
  const missing = items.filter((i): i is Extract<PackageItem, { source: "template" }> => i.source === "template").filter((i) => !byKey.has(i.templateKey));
  const individual = profile.type === "individual"; // spouse page only applies to a single individual

  return (
    <div>
      <div style={sub}>Subscription package · six parts, sent together</div>
      {PARTS.map((part) => {
        const rows = items.filter((i) => i.part === part.key);
        return (
          <div key={part.key} style={{ display: "grid", gridTemplateColumns: "30px minmax(0,1fr)", gap: 12, border: "1px solid #e3e9f2", borderRadius: 9, padding: "12px 14px", marginBottom: 9 }}>
            <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: 12, background: "#e8f0fe", color: BLUE, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{part.no}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: NAVY }}>{part.label}</div>
              <div style={{ fontSize: 11.5, color: MUTED, margin: "2px 0 6px" }}>{part.blurb}</div>
              {rows.map((r, i) => {
                if (r.source === "template") {
                  const t = byKey.get(r.templateKey);
                  return (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", fontSize: 12.5, color: NAVY, lineHeight: 1.9 }}>
                      <span>{t?.name ?? r.templateKey}</span>
                      {t ? (
                        <>
                          <span style={{ color: "#8a93a6", fontSize: 11 }}>
                            v{t.version} · used {t.usage} {t.usage === 1 ? "time" : "times"}
                          </span>
                          {isAdmin ? <button type="button" onClick={() => onReplace(t.id)} style={link}>Replace file</button> : null}
                          <button type="button" onClick={() => onHistory(t.id)} style={link}>History{t.versions > 1 ? ` (${t.versions})` : ""}</button>
                        </>
                      ) : (
                        <span style={{ color: "#8a6500", fontSize: 11 }}>not installed</span>
                      )}
                    </div>
                  );
                }
                if (r.source === "pdf") {
                  return (
                    <div key={i} style={{ fontSize: 12.5, color: NAVY, lineHeight: 1.9 }}>
                      {r.title} <span style={{ fontSize: 9.5, fontWeight: 700, background: "#FCEBEB", color: "#A32D2D", borderRadius: 4, padding: "1px 5px" }}>PDF</span>
                      <span style={{ color: r.applies ? "#0F6E56" : "#8a93a6", fontSize: 11 }}>{r.applies ? " applies to this subscriber" : " sent as published, not required of this subscriber"}</span>
                    </div>
                  );
                }
                return (
                  <div key={i} style={{ fontSize: 12, color: "#8a6500", lineHeight: 1.7 }}>
                    {r.title}{r.applies ? " (applies to this subscriber)" : ""}: {r.note}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ borderTop: "0.5px solid #eef1f5", margin: "16px 0 12px" }} />
      <div style={sub}>Subscriber · decides which forms and pages are included</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16 }}>
        <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
          <legend style={{ fontSize: 11.5, fontWeight: 600, color: "#3a4a63", marginBottom: 6, padding: 0 }}>Subscriber type</legend>
          {(["entity", "individual", "joint"] as const).map((t) => (
            <label key={t} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: NAVY, lineHeight: 2 }}>
              <input type="radio" name="sub-type" checked={profile.type === t} onChange={() => onProfile({ ...profile, type: t, spouseSigns: t === "individual" ? profile.spouseSigns : false })} />
              {t === "entity" ? "Entity" : t === "individual" ? "Individual" : "Joint individuals (both sign)"}
            </label>
          ))}
        </fieldset>
        <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
          <legend style={{ fontSize: 11.5, fontWeight: 600, color: "#3a4a63", marginBottom: 6, padding: 0 }}>U.S. person</legend>
          {[true, false].map((v) => (
            <label key={String(v)} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: NAVY, lineHeight: 2 }}>
              <input type="radio" name="sub-us" checked={profile.usPerson === v} onChange={() => onProfile({ ...profile, usPerson: v })} />
              {v ? "Yes" : "No"}
            </label>
          ))}
        </fieldset>
        <fieldset style={{ border: "none", margin: 0, padding: 0, opacity: individual ? 1 : 0.5 }} disabled={!individual}>
          <legend style={{ fontSize: 11.5, fontWeight: 600, color: "#3a4a63", marginBottom: 6, padding: 0 }}>Agreement of Spouse</legend>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: NAVY, lineHeight: 1.5, marginBottom: 4 }}>
            <input type="checkbox" style={{ marginTop: 3 }} checked={profile.spouseSigns && individual} onChange={(e) => onProfile({ ...profile, spouseSigns: e.target.checked })} />
            <span>Subscriber has a spouse and lives in {COMMUNITY_PROPERTY_STATES.join(", ")}</span>
          </label>
          <div style={{ fontSize: 11.5, color: MUTED }}>{spouseNote(profile)}</div>
        </fieldset>
      </div>

      {missing.length ? (
        <div style={{ marginTop: 12 }}>
          <Notice tone="warn">
            {isAdmin
              ? "Some subscription masters are not installed yet. Install the masters, then open the editor."
              : "Some subscription masters are not installed yet. Ask an admin to install them."}
          </Notice>
        </div>
      ) : null}
      {isAdmin && missingMasters > 0 ? (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Notice tone="info">{missingMasters === 1 ? "1 new master is" : `${missingMasters} new masters are`} available to install.</Notice>
          <button type="button" disabled={busy} onClick={onInstall} style={btn()}>{busy ? "Installing…" : "Install"}</button>
        </div>
      ) : null}

      {isAdmin && missingMasters === 0 ? (
        <div style={{ marginTop: 12, fontSize: 11.5, color: MUTED }}>
          After an app release, <button type="button" disabled={busy} onClick={onInstall} style={link}>update the masters</button> to save the shipped files as new versions (files you replaced yourself are left alone).
        </div>
      ) : null}
      <div style={{ marginTop: 12, padding: "10px 12px", background: "#f6f8fc", borderRadius: 8, fontSize: 11.5, color: MUTED, lineHeight: 1.6 }}>
        <b>Open editor</b> makes an editable copy of each part for this prospect; the masters never change. The Signature Pages are signed by the subscriber on a signing link; the other parts are sent to read.
      </div>
      <div style={{ textAlign: "right", marginTop: 14 }}>
        <button type="button" disabled={busy || missing.length > 0} onClick={onOpen} style={{ ...btn(true), opacity: busy || missing.length > 0 ? 0.5 : 1 }}>{openLabel}</button>
      </div>
    </div>
  );
}
