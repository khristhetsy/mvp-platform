"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { MarketingList, MarketingTemplate } from "@/lib/marketing/types";
import { DEPARTMENTS } from "@/lib/marketing/department-grouping";
import { platformInputToIso } from "@/lib/time/platform-input";
import { WizardFrame } from "@/components/founder/social/LaunchFrame";
import { btn } from "@/components/founder/social/FounderSocialShared";
import { SandboxedHtmlPreview } from "@/components/admin/SandboxedHtmlPreview";
import { EmailImageLibrary } from "@/components/marketing/EmailImagePicker";
import { FOLLOW_UP_CONDITIONS, MAX_FOLLOW_UPS, type FollowUpCondition } from "@/lib/marketing/campaign-follow-ups";
import { appendMedia, mediaBlockHtml, safeHttpUrl } from "@/lib/marketing/campaign-media";
import { WEEKDAY_LETTERS, combineDateTime, formatTime12, monthGrid, nextQuarterHour, shiftMonth, timeOptions } from "@/lib/marketing/campaign-schedule-picker";

const LABELS = ["Name", "Audience", "Message", "Sequence", "Schedule", "Review"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#1A6CE4] focus:outline-none";
const lbl = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

type FollowUpRow = { key: number; template_id: string; delay_days: number; condition: FollowUpCondition };

/** Today in Pacific time as YYYY-MM-DDTHH:MM, matching how the platform reads schedule input. */
function ptNow(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

export function CampaignWizard({ lists, templates, defaultSender, senders = [], initialListId, matchEnabled = false, onClose, onCreated }: {
  lists: MarketingList[];
  templates: MarketingTemplate[];
  defaultSender?: { name: string; email: string; replyTo: string };
  senders?: { name: string; email: string }[];
  initialListId?: string;
  /** Match campaigns flag: shows the link to the Match campaign flow. */
  matchEnabled?: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [groupType, setGroupType] = useState("founder");
  const [department, setDepartment] = useState("");
  const [fromName, setFromName] = useState(defaultSender?.name || "iCapOS");
  const [fromEmail, setFromEmail] = useState(defaultSender?.email || "outreach@icapos.com");
  const [replyTo, setReplyTo] = useState(defaultSender?.replyTo || "admin@myicfos.com");
  const [listId, setListId] = useState(initialListId && lists.some((l) => l.id === initialListId) ? initialListId : lists[0]?.id ?? "");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const template = templates.find((t) => t.id === templateId) ?? null;
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [bodyHtml, setBodyHtml] = useState(template?.html_body ?? "");
  const bodyRef = useRef<HTMLDivElement>(null);
  const [showImages, setShowImages] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [followUps, setFollowUps] = useState<FollowUpRow[]>([]);
  const nextKey = useRef(1);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [cal, setCal] = useState(() => { const [y, m] = ptNow().split("T")[0].split("-").map(Number); return { year: y, month: m - 1 }; });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = lists.find((l) => l.id === listId) ?? null;
  const scheduledLocal = combineDateTime(date, time);
  const todayPt = ptNow().split("T")[0];
  const scheduleOk = when === "now" || (scheduledLocal !== "" && (platformInputToIso(scheduledLocal) ?? "") > new Date().toISOString());

  // Load the template into the editable body whenever the pick changes.
  useEffect(() => {
    if (!template) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed the draft from the newly picked template
    setSubject(template.subject ?? "");
    setBodyHtml(template.html_body ?? "");
    if (bodyRef.current) bodyRef.current.innerHTML = template.html_body ?? "";
  }, [template?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seed the editor once it mounts on the Message step.
  useEffect(() => {
    if (step === 2 && bodyRef.current) bodyRef.current.innerHTML = bodyHtml;
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  function addMedia(imageUrl: string | null, imageAlt: string | null, video: string | null) {
    const block = mediaBlockHtml({ imageUrl, imageAlt, videoUrl: video });
    if (!block) return;
    const next = appendMedia(bodyRef.current?.innerHTML ?? bodyHtml, block);
    if (bodyRef.current) bodyRef.current.innerHTML = next;
    setBodyHtml(next);
  }

  function addFollowUp() {
    if (followUps.length >= MAX_FOLLOW_UPS) return;
    setFollowUps((f) => [...f, { key: nextKey.current++, template_id: templates[0]?.id ?? "", delay_days: f.length === 0 ? 3 : 5, condition: "no_reply" }]);
  }
  const patchFollowUp = (key: number, patch: Partial<FollowUpRow>) => setFollowUps((f) => f.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const stepValid = [
    name.trim().length > 0 && fromEmail.trim().length > 0,
    !!listId,
    !!templateId && subject.trim().length > 0,
    followUps.every((f) => !!f.template_id),
    scheduleOk,
    true,
  ][step];

  async function launch() {
    setBusy(true);
    setError(null);
    try {
      const html = bodyRef.current?.innerHTML ?? bodyHtml;
      const payload: Record<string, unknown> = {
        name: name.trim(), list_id: listId, template_id: templateId, from_name: fromName, from_email: fromEmail, reply_to: replyTo,
        group_type: groupType, status: "draft",
        follow_ups: followUps.map(({ template_id, delay_days, condition }) => ({ template_id, delay_days, condition })),
        subject_override: template && subject !== template.subject ? subject : "",
        body_override: template && html && html !== template.html_body ? html : "",
      };
      if (department) payload.department = department;
      if (when === "later") {
        payload.scheduled_at = platformInputToIso(scheduledLocal);
        payload.action = "schedule";
      } else {
        payload.action = "send";
      }
      const res = await fetch("/api/marketing/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the campaign.");
    } finally {
      setBusy(false);
    }
  }

  const grid = useMemo(() => monthGrid(cal.year, cal.month), [cal]);
  const times = useMemo(() => timeOptions(), []);
  const dateLabel = date ? new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";

  return (
    <WizardFrame
      title="New campaign" part="Admin Marketing" labels={LABELS} step={step}
      onBack={() => (step === 0 ? onClose() : setStep(step - 1))}
      onNext={() => (step === LABELS.length - 1 ? void launch() : setStep(step + 1))}
      nextLabel={step === LABELS.length - 1 ? (when === "later" ? "Schedule campaign" : "Launch campaign") : "Next"}
      nextDisabled={!stepValid} busy={busy} onExit={onClose} exitLabel="Back to campaigns"
    >
      {step === 0 && (
        <div className="grid max-w-2xl gap-4">
          {matchEnabled && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Emailing founders their investor matches instead?{" "}
              <Link className="font-semibold underline" href="/admin/marketing/campaigns/match/new">Start a Match campaign</Link>
            </p>
          )}
          <div><label className={lbl}>Campaign name</label><input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Q4 investor outreach" autoFocus /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Group</label>
              <select className={field} value={groupType} onChange={(e) => setGroupType(e.target.value)}><option value="founder">Founder</option><option value="investor">Investor</option><option value="event">Event</option></select></div>
            <div><label className={lbl}>Department</label>
              <select className={field} value={department} onChange={(e) => setDepartment(e.target.value)}><option value="">Unassigned</option>{DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={lbl}>From name</label><input className={field} value={fromName} onChange={(e) => setFromName(e.target.value)} /></div>
            <div><label className={lbl}>From email</label>
              {senders.length > 0 ? (
                <select className={field} value={fromEmail} onChange={(e) => { setFromEmail(e.target.value); const s = senders.find((x) => x.email === e.target.value); if (s) setFromName(s.name); }}>
                  {!senders.some((s) => s.email === fromEmail) && fromEmail && <option value={fromEmail}>{fromEmail}</option>}
                  {senders.map((s) => <option key={s.email} value={s.email}>{s.name} &lt;{s.email}&gt;</option>)}
                </select>
              ) : <input className={field} value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />}
            </div>
            <div><label className={lbl}>Reply to</label><input className={field} value={replyTo} onChange={(e) => setReplyTo(e.target.value)} /></div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="max-w-2xl">
          <label className={lbl}>Audience list</label>
          {lists.length === 0 ? <p className="text-sm text-slate-500">No marketing lists yet. Create one under Marketing, Lists.</p> : (
            <div className="grid gap-2">
              {lists.map((l) => (
                <button key={l.id} type="button" onClick={() => setListId(l.id)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${l.id === listId ? "border-[#1A6CE4] bg-[#EEF4FE]" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                  <span className="font-medium text-slate-900">{l.name}</span>
                  <span className="text-xs text-slate-500">{l.contact_count ?? 0} contacts</span>
                </button>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">Unsubscribed contacts are skipped automatically at send time.</p>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="grid content-start gap-3">
            <div><label className={lbl}>Template</label>
              <select className={field} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div><label className={lbl}>Subject</label><input className={field} value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
            <div><label className={lbl}>Body <span className="font-normal normal-case">click to edit</span></label>
              <div ref={bodyRef} contentEditable suppressContentEditableWarning onInput={(e) => setBodyHtml((e.currentTarget as HTMLDivElement).innerHTML)}
                className="max-h-72 overflow-auto rounded-lg border border-slate-300 bg-white p-3 text-sm" /></div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between"><span className={lbl + " mb-0"}>Image or video</span>
                <button type="button" className={btn} onClick={() => setShowImages((v) => !v)}>{showImages ? "Hide library" : "Choose image"}</button></div>
              {showImages && (
                <div className="max-h-60 overflow-auto">
                  <EmailImageLibrary mode="insert" onSelect={(img) => { addMedia(img.public_url, img.alt_text ?? img.name, null); setShowImages(false); }} />
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <input className={field} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Paste a video link (YouTube, Vimeo, Loom)" />
                <button type="button" className={btn} disabled={!safeHttpUrl(videoUrl)} onClick={() => { addMedia(null, null, videoUrl); setVideoUrl(""); }}>Add video</button>
              </div>
              <p className="mt-1 text-xs text-slate-500">Inboxes can&rsquo;t play video, so the link shows as a button that opens it.</p>
            </div>
          </div>
          <div>
            <span className={lbl}>Live preview</span>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 rounded-md bg-white px-3 py-2 text-xs"><b className="text-slate-900">{fromName}</b> <span className="text-slate-700">{subject || "No subject"}</span></div>
              <div className="rounded-md bg-white">
                <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">From {fromName} &lt;{fromEmail}&gt; to {list?.name ?? "no list"}</div>
                <SandboxedHtmlPreview html={bodyHtml} title="Email preview" minHeight={160} maxHeight={420} padding={12} />
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="max-w-3xl">
          <p className="mb-3 text-sm text-slate-600">Optional. Follow ups go to the same list after email 1 finishes sending. They are queued for your approval before anything is sent.</p>
          <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"><b>Email 1</b> <span className="text-slate-500">{subject || template?.name}</span></div>
          {followUps.map((f, i) => (
            <div key={f.key} className="mb-3 grid grid-cols-[1fr_90px_160px_auto] items-end gap-2 rounded-lg border border-slate-200 p-3">
              <div><label className={lbl}>Follow up {i + 1} template</label>
                <select className={field} value={f.template_id} onChange={(e) => patchFollowUp(f.key, { template_id: e.target.value })}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div><label className={lbl}>Wait (days)</label>
                <input type="number" min={0} max={90} className={field} value={f.delay_days} onChange={(e) => patchFollowUp(f.key, { delay_days: Math.max(0, Number(e.target.value) || 0) })} /></div>
              <div><label className={lbl}>Condition</label>
                <select className={field} value={f.condition} onChange={(e) => patchFollowUp(f.key, { condition: e.target.value as FollowUpCondition })}>{FOLLOW_UP_CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
              <button type="button" className={btn} onClick={() => setFollowUps((all) => all.filter((r) => r.key !== f.key))}>Remove</button>
            </div>
          ))}
          <button type="button" className={btn} onClick={addFollowUp} disabled={followUps.length >= MAX_FOLLOW_UPS || templates.length === 0}>+ Add follow up</button>
          <p className="mt-3 text-xs text-slate-500">Contacts who unsubscribe are removed from every follow up. &ldquo;If no reply&rdquo; checks replies to the follow up sequence itself.</p>
        </div>
      )}

      {step === 4 && (
        <div className="grid max-w-3xl gap-5 md:grid-cols-2">
          <div className="grid content-start gap-2">
            <label className="flex items-center gap-2 text-sm"><input type="radio" checked={when === "now"} onChange={() => setWhen("now")} /> Send as soon as I launch</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" checked={when === "later"} onChange={() => { setWhen("later"); if (!date) { const n = nextQuarterHour(ptNow()); setDate(n.date); setTime(n.time); } }} /> Pick a date and time</label>
            {when === "later" && (
              <div>
                <label className={lbl}>Time (Pacific)</label>
                <select className={field} value={time} onChange={(e) => setTime(e.target.value)}>{times.map((t) => <option key={t} value={t}>{formatTime12(t)}</option>)}</select>
                {dateLabel && <p className="mt-2 text-sm text-slate-700">{dateLabel}, {formatTime12(time)} PT</p>}
                {!scheduleOk && <p className="mt-1 text-xs text-red-600">Pick a time in the future.</p>}
              </div>
            )}
          </div>
          {when === "later" && (
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <button type="button" className={btn} onClick={() => setCal((c) => shiftMonth(c.year, c.month, -1))} aria-label="Previous month">‹</button>
                <b className="text-sm">{MONTHS[cal.month]} {cal.year}</b>
                <button type="button" className={btn} onClick={() => setCal((c) => shiftMonth(c.year, c.month, 1))} aria-label="Next month">›</button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {WEEKDAY_LETTERS.map((w, i) => <span key={i} className="text-slate-400">{w}</span>)}
                {grid.flat().map((c, i) => c ? (
                  <button key={c.date} type="button" disabled={c.date < todayPt} onClick={() => setDate(c.date)}
                    className={`rounded-md py-1.5 text-sm disabled:text-slate-300 ${c.date === date ? "bg-[#1A6CE4] font-semibold text-white" : "hover:bg-slate-100"}`}>{c.day}</button>
                ) : <span key={`e${i}`} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="max-w-2xl">
          <dl className="grid grid-cols-[130px_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Name</dt><dd className="font-medium">{name}</dd>
            <dt className="text-slate-500">From</dt><dd>{fromName} &lt;{fromEmail}&gt;</dd>
            <dt className="text-slate-500">Audience</dt><dd>{list?.name} ({list?.contact_count ?? 0} contacts)</dd>
            <dt className="text-slate-500">Subject</dt><dd>{subject}</dd>
            <dt className="text-slate-500">Follow ups</dt>
            <dd>{followUps.length === 0 ? "None" : followUps.map((f, i) => `${i + 1}. ${templates.find((t) => t.id === f.template_id)?.name ?? "Template"}, wait ${f.delay_days} days, ${FOLLOW_UP_CONDITIONS.find((c) => c.value === f.condition)?.label.toLowerCase()}`).join("; ")}</dd>
            <dt className="text-slate-500">Sends</dt><dd>{when === "now" ? "As soon as you launch" : `${dateLabel}, ${formatTime12(time)} PT`}</dd>
          </dl>
          {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>
      )}
    </WizardFrame>
  );
}
