"use client";

// Admin, Private Market board, Weekly emailer: edit the founder and investor
// weekly emails, pick who gets them (platform groups and Marketing lists),
// schedule them in Pacific Time, send a test, and watch a live preview.

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { groupByDepartment, departmentOf } from "@/lib/marketing/department-grouping";
import { countRuns, formatPt, nextRuns, todayInPt, type RepeatRule } from "@/lib/marketing/sequence-schedule";
import {
  AUDIENCES, BANNER_MAX_BYTES, NOTE_QUICK_INSERTS, PRESET_BANNER_PATH, MERGE_FIELDS, SECTION_OPTIONS, renderWeeklyEmail,
  type Audience, type EmailLinks, type WeeklyEmailConfig,
} from "@/lib/private-market/weekly-email";
import type { DigestMarket } from "@/lib/private-market/weekly-digest";
import type { FactOption, Target } from "@/lib/private-market/weekly-ai";
import type { WriterOption } from "@/lib/private-market/weekly-ai-server";
import { WeeklyAiWriter } from "./WeeklyAiWriter";
import type { PreviewExample } from "@/lib/private-market/weekly-data";
import type { WeeklySchedule, WeeklyState } from "@/lib/private-market/weekly-store";

export type ListOption = { id: string; name: string; department: string | null; count: number };

type Props = {
  initial: Record<Audience, WeeklyState>;
  lists: ListOption[];
  groupCounts: Record<Audience, number>;
  market: DigestMarket | null;
  examples: { founder: PreviewExample[]; investor: PreviewExample[] } | null;
  writers: WriterOption[];
  facts: Record<Audience, FactOption[]> | null;
  links: EmailLinks;
};

const REPEATS: Array<{ key: RepeatRule; label: string }> = [
  { key: "once", label: "Once" }, { key: "daily", label: "Daily" }, { key: "weekdays", label: "Weekdays" },
  { key: "weekly", label: "Weekly" }, { key: "monthly", label: "Monthly" },
];
const DAYS = [{ d: 1, l: "M" }, { d: 2, l: "T" }, { d: 3, l: "W" }, { d: 4, l: "T" }, { d: 5, l: "F" }, { d: 6, l: "S" }, { d: 0, l: "S" }];
const REMINDERS = [{ v: 60, l: "1 hour before each run" }, { v: 180, l: "3 hours before each run" }, { v: 1440, l: "The day before" }, { v: 0, l: "Off" }];

const card: React.CSSProperties = { border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 16, background: "#fff", marginBottom: 14 };
const h: React.CSSProperties = { margin: "0 0 10px", fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted-foreground)" };
const lab: React.CSSProperties = { fontSize: 11.5, color: "var(--muted-foreground)", display: "block", marginBottom: 4 };
const inp: React.CSSProperties = { width: "100%", fontSize: 13, padding: "7px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "#fff", color: "var(--foreground)", boxSizing: "border-box" };
const btn = (primary = false, disabled = false): React.CSSProperties => ({ fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 8, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, border: primary ? "none" : "0.5px solid var(--border)", background: primary ? "#1d4ed8" : "#fff", color: primary ? "#fff" : "var(--foreground)" });
const seg = (on: boolean): React.CSSProperties => ({ fontSize: 12.5, padding: "6px 11px", borderRadius: 999, cursor: "pointer", border: "0.5px solid var(--border)", background: on ? "var(--foreground)" : "#fff", color: on ? "var(--background)" : "var(--foreground)" });

type Draft = { config: WeeklyEmailConfig; schedule: WeeklySchedule; maxText: string };

const draftOf = (s: WeeklyState): Draft => ({ config: s.config, schedule: s.schedule, maxText: String(s.schedule.max_per_run) });

export function WeeklyEmailerClient({ initial, lists, groupCounts, market, examples, writers, facts, links }: Props) {
  const [aud, setAud] = useState<Audience>("founder");
  const [drafts, setDrafts] = useState<Record<Audience, Draft>>({ founder: draftOf(initial.founder), investor: draftOf(initial.investor) });
  const [saved, setSaved] = useState<Record<Audience, boolean>>({ founder: initial.founder.saved, investor: initial.investor.saved });
  const [q, setQ] = useState("");
  const [device, setDevice] = useState<"d" | "m">("d");
  const [asKey, setAsKey] = useState<Record<Audience, string>>({ founder: "", investor: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testTo, setTestTo] = useState<string[]>(["kthetsy@myicfos.com"]);
  const [testAdd, setTestAdd] = useState("");
  const [testVer, setTestVer] = useState<Audience>("founder");
  const [testEx, setTestEx] = useState("");
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [sel, setSel] = useState({ start: 0, end: 0, text: "" });

  const d = drafts[aud];
  const c = d.config;
  const s = d.schedule;
  const patch = (p: Partial<WeeklyEmailConfig>) => { setDrafts((x) => ({ ...x, [aud]: { ...x[aud], config: { ...x[aud].config, ...p } } })); setMsg(null); };
  const patchS = (p: Partial<WeeklySchedule>) => { setDrafts((x) => ({ ...x, [aud]: { ...x[aud], schedule: { ...x[aud].schedule, ...p } } })); setMsg(null); };

  const exs = examples?.[aud] ?? [];
  const ex = exs.find((e) => e.key === asKey[aud]) ?? exs[0];

  const preview = useMemo(() => {
    if (!market || !ex) return null;
    return renderWeeklyEmail({ config: c, market, viewer: ex.viewer, links });
  }, [c, market, ex, links]);

  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groupByDepartment(lists.filter((l) => l.name.toLowerCase().includes(needle)), (l) => departmentOf(l.department));
  }, [lists, q]);

  const picked = useMemo(() => {
    const groups = c.groups.map((g) => ({ key: `g:${g}`, label: g === "founder" ? "All founders" : "All approved investors", n: groupCounts[g] }));
    const ls = c.listIds.map((id) => lists.find((l) => l.id === id)).filter((l): l is ListOption => !!l).map((l) => ({ key: `l:${l.id}`, label: l.name, n: l.count }));
    const all = [...groups, ...ls];
    return { all, total: all.reduce((a, b) => a + b.n, 0), multi: all.length > 1 };
  }, [c.groups, c.listIds, groupCounts, lists]);

  const runs = useMemo(() => {
    const t = { start_date: s.start_date, end_date: s.end_date || null, repeat: s.repeat, weekdays: s.weekdays, send_time: s.send_time };
    return { next: nextRuns(t, new Date(), 4), total: countRuns(t) };
  }, [s]);

  const nyText = useMemo(() => {
    const [hh, mm] = (s.send_time || "05:00").split(":").map(Number);
    const fmt = (h: number) => `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
    return `${fmt(hh)} Pacific is ${fmt((hh + 3) % 24)} New York.`;
  }, [s.send_time]);

  const toggleGroup = (g: Audience) => patch({ groups: c.groups.includes(g) ? c.groups.filter((x) => x !== g) : [...c.groups, g] });
  const toggleList = (id: string) => patch({ listIds: c.listIds.includes(id) ? c.listIds.filter((x) => x !== id) : [...c.listIds, id] });

  async function post(action: string, extra: Record<string, unknown>) {
    const res = await fetch("/api/admin/private-market/weekly-emailer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
    return data;
  }

  function schedulePayload(enabled: boolean) {
    return { enabled, start_date: s.start_date, end_date: s.end_date || null, repeat: s.repeat, weekdays: s.weekdays, send_time: s.send_time, max_per_run: Number(d.maxText) || 0, reminder_minutes: s.reminder_minutes, unreviewed_action: s.unreviewed_action };
  }

  async function save(enabled: boolean, doneText: string) {
    setBusy("save"); setMsg(null);
    try {
      await post("save", { config: c, schedule: schedulePayload(enabled) });
      patchS({ enabled }); setSaved((x) => ({ ...x, [aud]: true }));
      setMsg({ ok: true, text: doneText });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed." }); }
    finally { setBusy(null); }
  }

  async function uploadBanner(file: File | undefined) {
    if (!file) return;
    if (file.size > BANNER_MAX_BYTES) { setBannerMsg("That file is over 1 MB. Choose a smaller one."); return; }
    if (!["image/png", "image/jpeg"].includes(file.type)) { setBannerMsg("Use a PNG or JPG image."); return; }
    setBusy("banner"); setBannerMsg(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/marketing/assets/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed.");
      patch({ bannerUrl: data.url as string });
      setBannerMsg(`${file.name} uploaded.`);
    } catch (e) { setBannerMsg(e instanceof Error ? e.message : "Upload failed."); }
    finally { setBusy(null); }
  }

  async function review() {
    setBusy("review");
    try {
      const r = await post("review", { audience: aud });
      setMsg({ ok: true, text: r.reviewedFor ? `Marked reviewed for ${formatPt(new Date(r.reviewedFor))}.` : "No upcoming send to review." });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed." }); }
    finally { setBusy(null); }
  }

  async function sendTest() {
    setBusy("test"); setMsg(null);
    try {
      const cfg = drafts[testVer].config;
      const r = await post("test", { config: cfg, to: testTo, example: testEx });
      setMsg(r.ok ? { ok: true, text: `Test sent to ${r.sent} ${r.sent === 1 ? "address" : "addresses"}. Subject: ${r.subject}. Nothing was sent to your recipient lists.` } : { ok: false, text: `Not delivered to: ${r.failed.join(", ")}.` });
      setTestOpen(false);
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed." }); setTestOpen(false); }
    finally { setBusy(null); }
  }

  const testExamples = examples?.[testVer] ?? [];
  const sectionOptions = SECTION_OPTIONS[aud];

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "4px 0 40px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Weekly emailer</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>The Private Market weekly email for founders and investors. Real platform numbers, sent on your schedule.</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Link href="/private-market" style={seg(false)}>Board</Link>
          <span style={seg(true)}>Weekly emailer</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 440px), 1fr))", gap: 20, marginTop: 16 }}>
        <div>
          <div style={card}>
            <p style={h}>Email version</p>
            <div style={{ display: "flex", gap: 6 }}>
              {AUDIENCES.map((a) => (
                <button key={a} type="button" style={seg(a === aud)} onClick={() => { setAud(a); setMsg(null); }}>{a === "founder" ? "Founder email" : "Investor email"}</button>
              ))}
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted-foreground)" }}>
              Each version has its own content, recipients and schedule. {saved[aud] ? (s.enabled ? "Scheduled." : "Saved as a draft.") : "Not saved yet."}
            </p>
          </div>

          <div style={card}>
            <p style={h}>Send to</p>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 6 }}>
              <input type="checkbox" checked={c.groups.includes(aud)} onChange={() => toggleGroup(aud)} />
              {aud === "founder" ? "All founders with a workspace" : "All approved investors"} <b>({groupCounts[aud].toLocaleString()})</b>
            </label>
            <p style={{ ...lab, marginTop: 10 }}>Contact lists from Marketing, Lists</p>
            <input style={inp} placeholder="Search lists" value={q} onChange={(e) => setQ(e.target.value)} />
            <div style={{ maxHeight: 220, overflow: "auto", marginTop: 8, border: "0.5px solid var(--border)", borderRadius: 8, padding: "4px 10px" }}>
              {grouped.length === 0 && <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>No lists match.</p>}
              {grouped.map((g) => (
                <div key={g.dept}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", color: "var(--muted-foreground)", margin: "8px 0 2px" }}>{g.dept.toUpperCase()}</div>
                  {g.items.map((l) => (
                    <label key={l.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "3px 0", opacity: l.count === 0 ? 0.45 : 1 }}>
                      <input type="checkbox" disabled={l.count === 0} checked={c.listIds.includes(l.id)} onChange={() => toggleList(l.id)} />
                      <span style={{ flex: 1 }}>{l.name}</span>
                      <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{l.count.toLocaleString()}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {picked.all.map((p) => (
                <span key={p.key} style={{ ...seg(false), display: "inline-flex", gap: 6, alignItems: "center", cursor: "default" }}>
                  {p.label}
                  <b style={{ cursor: "pointer" }} onClick={() => (p.key.startsWith("g:") ? toggleGroup(p.key.slice(2) as Audience) : toggleList(p.key.slice(2)))}>×</b>
                </span>
              ))}
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12.5 }}>
              <b>{picked.all.length} selected</b> · up to <b>{picked.total.toLocaleString()}</b> recipients{picked.multi ? " or fewer" : ""}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "var(--muted-foreground)" }}>
              Each address gets one email. Unsubscribed and held contacts are skipped. Platform {aud === "founder" ? "founders" : "investors"} get their own {aud === "founder" ? "rating" : "matches"}; other contacts get the market sections only.
            </p>
          </div>

          <div style={card}>
            <p style={h}>Email header</p>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" style={seg(c.headerMode === "std")} onClick={() => patch({ headerMode: "std" })}>Logo and title</button>
              <button type="button" style={seg(c.headerMode === "banner")} onClick={() => patch({ headerMode: "banner", bannerUrl: c.bannerUrl ?? `${links.appUrl}${PRESET_BANNER_PATH}` })}>Banner image</button>
            </div>
            {c.headerMode === "banner" ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  {c.bannerUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.bannerUrl} alt="" style={{ width: 150, height: "auto", border: "0.5px solid var(--border)", borderRadius: 8 }} />
                  ) : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" style={btn()} onClick={() => { patch({ bannerUrl: `${links.appUrl}${PRESET_BANNER_PATH}` }); setBannerMsg(null); }}>Use the Private Market banner</button>
                    <label style={{ ...btn(false, busy === "banner"), display: "inline-block" }}>
                      {busy === "banner" ? "Uploading" : "Upload your own"}
                      <input type="file" accept="image/png,image/jpeg" style={{ display: "none" }} disabled={busy === "banner"} onChange={(e) => { void uploadBanner(e.target.files?.[0]); e.target.value = ""; }} />
                    </label>
                    <button type="button" style={btn()} onClick={() => { patch({ headerMode: "std", bannerUrl: null }); setBannerMsg(null); }}>Remove</button>
                  </div>
                </div>
                {bannerMsg && <p role="status" style={{ margin: "8px 0 0", fontSize: 12.5 }}>{bannerMsg}</p>}
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginTop: 12 }}>
                  <input type="checkbox" checked={c.bannerStrip} onChange={(e) => patch({ bannerStrip: e.target.checked })} /> Show the title strip under the banner
                </label>
                <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--muted-foreground)" }}>Best at 2172 x 724 (3:1), PNG or JPG, 1 MB at most. Shown at 640 px wide, so keep text large. Leave live figures out of the image, they will not update each week.</p>
              </div>
            ) : (
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted-foreground)" }}>The iCapOS logo with the navy title block. Each version keeps its own header.</p>
            )}
          </div>

          <div style={card}>
            <p style={h}>Subject and intro</p>
            <label style={lab}>Subject line</label>
            <input style={inp} value={c.subject} onChange={(e) => patch({ subject: e.target.value })} />
            <p style={{ margin: "4px 0 10px", fontSize: 11.5, color: "var(--muted-foreground)" }}>Merge fields: {MERGE_FIELDS.join("  ")}</p>
            <label style={lab}>Preheader</label>
            <input style={inp} value={c.preheader} onChange={(e) => patch({ preheader: e.target.value })} />
            <label style={{ ...lab, marginTop: 12 }}>Note from iCapOS (optional)</label>
            <textarea
              ref={noteRef}
              style={{ ...inp, minHeight: 70 }}
              maxLength={600}
              value={c.note}
              onChange={(e) => { patch({ note: e.target.value }); setSel({ start: 0, end: 0, text: "" }); }}
              onSelect={(e) => { const t = e.currentTarget; setSel({ start: t.selectionStart, end: t.selectionEnd, text: t.value.slice(t.selectionStart, t.selectionEnd) }); }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {NOTE_QUICK_INSERTS.map((n) => <button key={n.label} type="button" style={seg(false)} onClick={() => patch({ note: n.text })}>{n.label}</button>)}
              <button type="button" style={seg(false)} onClick={() => patch({ note: "" })}>Clear</button>
            </div>
          </div>

          {facts && (
            <WeeklyAiWriter
              key={aud}
              audience={aud}
              writers={writers}
              facts={facts[aud]}
              styles={{ card, h, lab, inp, seg }}
              selection={sel}
              signOff={c.signOff}
              onSignOff={(name) => patch({ signOff: name })}
              onUse={(target: Target, text: string) => patch(target === "subject" ? { subject: text } : target === "preheader" ? { preheader: text } : { note: text.slice(0, 600) })}
              onReplaceSelection={(start, end, text) => { patch({ note: (c.note.slice(0, start) + text + c.note.slice(end)).slice(0, 600) }); setSel({ start: 0, end: 0, text: "" }); }}
            />
          )}

          <div style={card}>
            <p style={h}>Sections</p>
            {sectionOptions.map((o) => (
              <label key={o.key} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "2px 0" }}>
                <input type="checkbox" checked={c.sections[o.key] !== false} onChange={(e) => patch({ sections: { ...c.sections, [o.key]: e.target.checked } })} /> {o.label}
              </label>
            ))}
            <label style={{ ...lab, marginTop: 12 }}>Button text</label>
            <input style={inp} value={c.buttonText} onChange={(e) => patch({ buttonText: e.target.value })} />
          </div>

          <div style={card}>
            <p style={h}>Schedule</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {REPEATS.map((r) => <button key={r.key} type="button" style={seg(s.repeat === r.key)} onClick={() => patchS({ repeat: r.key })}>{r.label}</button>)}
            </div>
            {s.repeat === "weekly" && (
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {DAYS.map((x) => <button key={x.d} type="button" style={seg(s.weekdays.includes(x.d))} onClick={() => patchS({ weekdays: s.weekdays.includes(x.d) ? s.weekdays.filter((y) => y !== x.d) : [...s.weekdays, x.d] })}>{x.l}</button>)}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, marginTop: 12 }}>
              <div><label style={lab}>Start date</label><input style={inp} type="date" value={s.start_date} min={todayInPt()} onChange={(e) => patchS({ start_date: e.target.value })} /></div>
              <div><label style={lab}>End date (optional)</label><input style={inp} type="date" value={s.end_date ?? ""} onChange={(e) => patchS({ end_date: e.target.value || null })} /></div>
              <div><label style={lab}>Send time (Pacific)</label><input style={inp} type="time" value={s.send_time} onChange={(e) => patchS({ send_time: e.target.value })} /></div>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted-foreground)" }}>{nyText}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, marginTop: 12 }}>
              <div><label style={lab}>Max emails per run</label><input style={inp} inputMode="numeric" value={d.maxText} onChange={(e) => setDrafts((x) => ({ ...x, [aud]: { ...x[aud], maxText: e.target.value.replace(/\D/g, "") } }))} /><span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>5,000 is the most</span></div>
              <div><label style={lab}>Review reminder</label><select style={inp} value={s.reminder_minutes} onChange={(e) => patchS({ reminder_minutes: Number(e.target.value) })}>{REMINDERS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}</select></div>
              <div><label style={lab}>If not reviewed</label><select style={inp} value={s.unreviewed_action} onChange={(e) => patchS({ unreviewed_action: e.target.value as "send" | "hold" })}><option value="send">Send anyway</option><option value="hold">Hold until reviewed</option></select></div>
            </div>
            <p style={{ ...lab, marginTop: 12 }}>Next sends</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {runs.next.length ? runs.next.map((r) => <li key={r.toISOString()}>{formatPt(r)}</li>) : <li>No runs in this range</li>}
            </ul>
            {runs.total > 0 && <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "var(--muted-foreground)" }}>{runs.total >= 500 ? "500+" : runs.total} runs in this range.</p>}
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginTop: 12 }}>
              <input type="checkbox" checked={c.skipIfUnchanged} onChange={(e) => patch({ skipIfUnchanged: e.target.checked })} /> Skip a week when nothing changed
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
              <div><label style={lab}>Sender name</label><input style={inp} placeholder="iCapOS" value={c.fromName ?? ""} onChange={(e) => patch({ fromName: e.target.value || null })} /></div>
              <div><label style={lab}>Sender address</label><input style={inp} placeholder="Default sender (iCapOS)" value={c.fromEmail ?? ""} onChange={(e) => patch({ fromEmail: e.target.value || null })} /></div>
            </div>
          </div>

          <div style={card}>
            <p style={h}>Send</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" style={btn(false, !market)} disabled={!market} onClick={() => { setTestVer(aud); setTestEx(""); setTestOpen(true); }}>Send test email</button>
              <button type="button" style={btn(false, busy !== null)} disabled={busy !== null} onClick={() => save(false, "Draft saved. Nothing is scheduled.")}>Save draft</button>
              <button type="button" style={btn(true, busy !== null)} disabled={busy !== null} onClick={() => save(true, `Scheduled. Next send ${runs.next[0] ? formatPt(runs.next[0]) : "has no date in this range"}.`)}>{s.enabled ? "Update schedule" : "Schedule weekly send"}</button>
              {s.enabled && <button type="button" style={btn(false, busy !== null)} disabled={busy !== null} onClick={() => save(false, "Paused. Nothing will send until you schedule it again.")}>Pause</button>}
              {s.enabled && <button type="button" style={btn(false, busy !== null)} disabled={busy !== null} onClick={review}>Mark next send reviewed</button>}
            </div>
            {msg && <p role="status" style={{ margin: "10px 0 0", fontSize: 13, color: msg.ok ? "#166534" : "#b42318" }}>{msg.text}</p>}
          </div>
        </div>

        <div style={{ position: "sticky", top: 12, alignSelf: "start" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" style={seg(device === "d")} onClick={() => setDevice("d")}>Desktop</button>
              <button type="button" style={seg(device === "m")} onClick={() => setDevice("m")}>Mobile</button>
            </div>
            {exs.length > 0 && (
              <select style={{ ...inp, width: "auto" }} value={ex?.key ?? ""} onChange={(e) => setAsKey((x) => ({ ...x, [aud]: e.target.value }))}>
                {exs.map((e) => <option key={e.key} value={e.key}>As: {e.label}</option>)}
              </select>
            )}
          </div>
          {preview ? (
            <div style={{ border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
              <div style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--border)" }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{preview.subject}</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{preview.preheader || " "}</div>
              </div>
              <iframe title="Email preview" sandbox="" srcDoc={preview.html} style={{ width: device === "m" ? 390 : "100%", maxWidth: "100%", height: 880, border: 0, display: "block", margin: "0 auto", background: "#e9eef7" }} />
            </div>
          ) : (
            <div style={{ ...card, fontSize: 13 }}>The market numbers could not be read right now, so there is no preview and nothing will be sent. Reload to try again.</div>
          )}
        </div>
      </div>

      {testOpen && (
        <div role="dialog" aria-modal="true" aria-label="Send test email" onClick={(e) => { if (e.target === e.currentTarget) setTestOpen(false); }} style={{ position: "fixed", inset: 0, background: "rgba(15,27,61,.45)", display: "grid", placeItems: "center", zIndex: 50, padding: 16 }}>
          <div style={{ ...card, width: "100%", maxWidth: 480, marginBottom: 0 }}>
            <p style={h}>Send test email</p>
            <label style={lab}>Recipients (press Enter to add)</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              {testTo.map((a) => <span key={a} style={{ ...seg(false), cursor: "default" }}>{a} <b style={{ cursor: "pointer" }} onClick={() => setTestTo(testTo.filter((x) => x !== a))}>×</b></span>)}
            </div>
            <input style={inp} placeholder="name@company.com" value={testAdd} onChange={(e) => setTestAdd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && testAdd.trim()) { e.preventDefault(); setTestTo([...new Set([...testTo, testAdd.trim().toLowerCase()])]); setTestAdd(""); } }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
              <div><label style={lab}>Version</label><select style={inp} value={testVer} onChange={(e) => { setTestVer(e.target.value as Audience); setTestEx(""); }}><option value="founder">Founder email</option><option value="investor">Investor email</option></select></div>
              <div><label style={lab}>Example data</label><select style={inp} value={testEx || testExamples[0]?.key || ""} onChange={(e) => setTestEx(e.target.value)}>{testExamples.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}</select></div>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted-foreground)" }}>The subject starts with [TEST] and a yellow strip marks the email. It goes only to the addresses above, never to your lists, and does not count as a weekly send.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button type="button" style={btn()} onClick={() => setTestOpen(false)}>Cancel</button>
              <button type="button" style={btn(true, busy === "test" || testTo.length === 0)} disabled={busy === "test" || testTo.length === 0} onClick={sendTest}>{busy === "test" ? "Sending" : "Send test"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
