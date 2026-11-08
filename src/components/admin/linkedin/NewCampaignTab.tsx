"use client";

import { useState } from "react";
import type { AudiencePreview } from "@/lib/linkedin/store";
import { INVITE_NOTE_LIMIT, MAX_VARIANTS } from "@/lib/linkedin/limits";
import { Choice, ErrorLine, Field, Section, api, btnCls, inputCls, primaryCls } from "./ui";

type Variant = { id: string; text: string };
const FIRST_INVITE = "Hi {first_name}, I saw your work at {company}. I'd like to connect and share how we help companies raise capital.";
const FIRST_MESSAGE = "Thanks for connecting, {first_name}. Here is a short chat that learns what you look for and can book a call with our team: {link}";

export function NewCampaignTab({ onSaved }: Readonly<{ onSaved: () => void }>) {
  const [name, setName] = useState("");
  const [module, setModule] = useState<"investor" | "founder">("investor");
  const [stage, setStage] = useState("");
  const [tag, setTag] = useState("");
  const [industry, setIndustry] = useState("");
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [variants, setVariants] = useState<Variant[]>([{ id: "a", text: FIRST_INVITE }]);
  const [message, setMessage] = useState(FIRST_MESSAGE);
  const [handoff, setHandoff] = useState<"web_chat" | "linkedin">("web_chat");
  const [agent, setAgent] = useState<"johnny" | "jessica">("johnny");
  const [busy, setBusy] = useState<"preview" | "save" | "start" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filters = { module, ...(stage.trim() ? { stage: stage.trim() } : {}), ...(tag.trim() ? { tag: tag.trim() } : {}), ...(industry.trim() ? { industry: industry.trim() } : {}) };

  function pickModule(m: "investor" | "founder") {
    setModule(m); setAgent(m === "investor" ? "johnny" : "jessica"); setPreview(null);
  }

  async function runPreview() {
    setBusy("preview"); setError(null);
    const r = await api<AudiencePreview>("/api/admin/linkedin/audience", "POST", { filters });
    setBusy(null);
    if (r.ok) setPreview(r.data); else setError(r.error);
  }

  async function save(thenStart: boolean) {
    if (!name.trim()) { setError("Give the campaign a name."); return; }
    setBusy(thenStart ? "start" : "save"); setError(null);
    const created = await api<{ campaign: { id: string } }>("/api/admin/linkedin/campaigns", "POST", {
      name: name.trim(), audience: { source: "crm", filters }, invite_variants: variants, message_text: message, handoff_mode: handoff, agent,
    });
    if (!created.ok) { setBusy(null); setError(created.error); return; }
    if (thenStart) {
      const id = created.data.campaign.id;
      const approved = await api(`/api/admin/linkedin/campaigns/${id}`, "POST", { action: "approve" });
      if (!approved.ok) { setBusy(null); setError(`Saved as a draft. ${approved.error}`); onSaved(); return; }
      const started = await api(`/api/admin/linkedin/campaigns/${id}`, "POST", { action: "start" });
      if (!started.ok) { setBusy(null); setError(`Saved and approved. ${started.error}`); onSaved(); return; }
    }
    setBusy(null);
    onSaved();
  }

  const setVariant = (id: string, text: string) => setVariants((v) => v.map((x) => (x.id === id ? { ...x, text } : x)));

  return (
    <div className="space-y-4">
      <Section title="1. Who do you want to reach?" icon="ti-users">
        <div className="space-y-3 px-4 py-3">
          <Field label="Campaign name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Seed investors, fintech" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Contacts of type">
              <select className={inputCls} value={module} onChange={(e) => pickModule(e.target.value as "investor" | "founder")}>
                <option value="investor">Investors</option><option value="founder">Founders</option>
              </select>
            </Field>
            <Field label="Stage (optional)"><input className={inputCls} value={stage} onChange={(e) => { setStage(e.target.value); setPreview(null); }} /></Field>
            <Field label="Tag (optional)"><input className={inputCls} value={tag} onChange={(e) => { setTag(e.target.value); setPreview(null); }} /></Field>
            <Field label="Industry (optional)" hint="Matches the industry on the contact exactly."><input className={inputCls} value={industry} onChange={(e) => { setIndustry(e.target.value); setPreview(null); }} /></Field>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className={btnCls} disabled={busy !== null} onClick={runPreview}>{busy === "preview" ? "Counting…" : "Preview who this reaches"}</button>
            <span className="text-[12px] text-slate-500">Only contacts with a LinkedIn link are considered.</span>
          </div>
          {preview ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
              <b>{preview.summary.invite + preview.summary.manual + preview.summary.message + preview.summary.email_first}</b> people will be contacted:
              {" "}{preview.summary.invite} get an invite, {preview.summary.message} already connected get a message, {preview.summary.email_first} with an email get the email sequence first, {preview.summary.manual} high value ones become tasks for you.
              {" "}<span className="text-slate-500">{preview.summary.skipped} skipped: {preview.summary.skippedBy.do_not_contact} do not contact, {preview.summary.skippedBy.in_other_outreach} in another outreach.</span>
            </p>
          ) : null}
        </div>
      </Section>

      <Section title="2. What should we say?" icon="ti-message">
        <div className="space-y-3 px-4 py-3">
          <p className="text-[12.5px] text-slate-500">Write up to {MAX_VARIANTS} invite versions. One is picked at random for each person, so no two invites look identical. Use {"{first_name}"} and {"{company}"}. Each is at most {INVITE_NOTE_LIMIT} characters.</p>
          {variants.map((v, i) => (
            <Field key={v.id} label={`Invite version ${i + 1}`} hint={`${v.text.length} of ${INVITE_NOTE_LIMIT} characters`}>
              <div className="flex gap-2">
                <textarea className={inputCls} rows={2} value={v.text} onChange={(e) => setVariant(v.id, e.target.value)} />
                {variants.length > 1 ? <button type="button" aria-label="Remove version" className={btnCls} onClick={() => setVariants((x) => x.filter((y) => y.id !== v.id))}>Remove</button> : null}
              </div>
            </Field>
          ))}
          {variants.length < MAX_VARIANTS ? <button type="button" className={btnCls} onClick={() => setVariants((x) => [...x, { id: `v${Date.now().toString(36)}`, text: "" }])}>+ Add a version</button> : null}
          <Field label="Message after someone accepts" hint="{link} becomes the link to our web chat. It is added at the end if you leave it out.">
            <textarea className={inputCls} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <p className="text-[13px]"><b>Sending as:</b> your connected LinkedIn account. People see that name.</p>
          <div role="radiogroup" aria-label="Where the chat continues" className="space-y-2">
            <p className="text-[13px] font-semibold text-slate-800">When someone accepts, where should the chat continue?</p>
            <Choice selected={handoff === "web_chat"} onSelect={() => setHandoff("web_chat")} title="Move to our web chat" badge={<span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">Recommended</span>}>
              The first message includes a link. Johnny (investors) or Jessica (founders) qualifies and books the meeting. Lower account risk.
            </Choice>
            <Choice selected={handoff === "linkedin"} onSelect={() => setHandoff("linkedin")} title="Stay in LinkedIn">
              The AI answers inside LinkedIn through your account. Not active until the pilot shows the account stays healthy.
            </Choice>
          </div>
          <Field label="Chat agent">
            <select className={inputCls} value={agent} onChange={(e) => setAgent(e.target.value as "johnny" | "jessica")}>
              <option value="johnny">Johnny (investors)</option><option value="jessica">Jessica (founders)</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="3. Start" icon="ti-player-play">
        <div className="space-y-3 px-4 py-3">
          <p className="text-[13px] text-slate-700">We start slowly and speed up over 3 weeks to protect the account. Starting approves the wording above exactly as written. Change a word later and it needs approval again. You can stop any time.</p>
          <ErrorLine text={error} />
          <div className="flex gap-2">
            <button type="button" className={primaryCls} disabled={busy !== null} onClick={() => save(true)}>{busy === "start" ? "Starting…" : "Approve wording and start"}</button>
            <button type="button" className={btnCls} disabled={busy !== null} onClick={() => save(false)}>{busy === "save" ? "Saving…" : "Save for later"}</button>
          </div>
        </div>
      </Section>
    </div>
  );
}
