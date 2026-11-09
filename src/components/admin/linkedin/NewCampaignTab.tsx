"use client";

import { useState } from "react";
import { MAX_RESULT_PAGES, MESSAGE_LIMIT, READ_PAGES_PER_DAY } from "@/lib/linkedin/limits";
import { Choice, ErrorLine, Field, Section, api, btnCls, inputCls, primaryCls } from "./ui";

const FIRST_CONNECTED = "Hi {first_name}, it has been a while. I now run iCapOS, which helps founders measure capital readiness and meet the right investors. Click to chat with our AI assistant, it takes 2 minutes and can book a call with our team: {link}";

// Examples only. The sender types what you pick into LinkedIn's own filter and takes LinkedIn's closest match.
const INDUSTRIES = ["Venture Capital and Private Equity Principals", "Investment Management", "Investment Banking", "Capital Markets", "Financial Services", "Banking", "Insurance", "Software Development", "Technology, Information and Internet", "Real Estate"];
const LANGUAGES = ["English", "French", "Spanish", "German", "Portuguese", "Italian"];
const SORTS = [{ id: "recent", label: "Recently added" }, { id: "first", label: "First name" }, { id: "last", label: "Last name" }] as const;

type Sort = (typeof SORTS)[number]["id"];

export function NewCampaignTab({ onSaved }: Readonly<{ onSaved: () => void }>) {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [locations, setLocations] = useState("");
  const [currentCompany, setCurrentCompany] = useState("");
  const [pastCompany, setPastCompany] = useState("");
  const [school, setSchool] = useState("");
  const [profileLanguage, setProfileLanguage] = useState("");
  const [person, setPerson] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [connectedMessage, setConnectedMessage] = useState(FIRST_CONNECTED);
  const [handoff, setHandoff] = useState<"web_chat" | "linkedin">("web_chat");
  const [agent, setAgent] = useState<"johnny" | "jessica">("johnny");
  const [busy, setBusy] = useState<"save" | "start" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string): Record<string, string> => (v.trim() ? { [k]: v.trim() } : {});
  const filters = {
    ...set("industry", industry), ...set("locations", locations), ...set("currentCompany", currentCompany), ...set("pastCompany", pastCompany),
    ...set("school", school), ...set("profileLanguage", profileLanguage), ...set("name", person), sort,
  };

  async function save(thenStart: boolean) {
    if (!name.trim()) { setError("Give the campaign a name."); return; }
    if (!connectedMessage.trim()) { setError("Write the message people get."); return; }
    setBusy(thenStart ? "start" : "save"); setError(null);
    const created = await api<{ campaign: { id: string } }>("/api/admin/linkedin/campaigns", "POST", {
      name: name.trim(), audience: { source: "linkedin_network", filters }, invite_variants: [], message_text: null,
      connected_message_text: connectedMessage, handoff_mode: handoff, agent,
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

  const pickClass = (on: boolean) => `rounded-full border px-3.5 py-1.5 text-[13px] ${on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700"}`;

  return (
    <div className="space-y-4">
      <Section title="1. Who do you want to reach?" icon="ti-users">
        <div className="space-y-3 px-4 py-3">
          <Field label="Campaign name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Reconnect with my network" /></Field>

          <div>
            <p className="mb-1.5 text-[12px] text-slate-500">Audience</p>
            <div className="flex flex-wrap gap-2">
              <span className={pickClass(true)}>1st connections</span>
              <span className={`${pickClass(false)} opacity-45`}>2nd connections</span>
              <span className={`${pickClass(false)} opacity-45`}>3rd+ connections</span>
            </div>
            <p className="mt-1.5 text-[12px] text-slate-500">1st connections get a message, no invite. 2nd and 3rd+ need Connect invites and count toward LinkedIn&apos;s search limit, so they are not offered for this campaign type.</p>
          </div>

          <div>
            <p className="mb-1.5 text-[12px] text-slate-500">Filters, the same ones as &quot;Search with filters&quot; on LinkedIn (optional)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Industry"><input className={inputCls} list="li-industries" value={industry} onChange={(e) => setIndustry(e.target.value)} /></Field>
              <Field label="Locations"><input className={inputCls} value={locations} onChange={(e) => setLocations(e.target.value)} placeholder="Paris, France" /></Field>
              <Field label="Current company"><input className={inputCls} value={currentCompany} onChange={(e) => setCurrentCompany(e.target.value)} /></Field>
              <Field label="Past company"><input className={inputCls} value={pastCompany} onChange={(e) => setPastCompany(e.target.value)} /></Field>
              <Field label="School"><input className={inputCls} value={school} onChange={(e) => setSchool(e.target.value)} /></Field>
              <Field label="Profile language"><input className={inputCls} list="li-languages" value={profileLanguage} onChange={(e) => setProfileLanguage(e.target.value)} /></Field>
            </div>
            <datalist id="li-industries">{INDUSTRIES.map((x) => <option key={x} value={x} />)}</datalist>
            <datalist id="li-languages">{LANGUAGES.map((x) => <option key={x} value={x} />)}</datalist>
            <p className="mt-1.5 text-[12px] text-slate-500">Type the first letters. The sender enters it into LinkedIn and takes LinkedIn&apos;s closest match. If LinkedIn has no match, nothing is read and nobody is messaged.</p>
          </div>

          <Field label="Search by name (optional)"><input className={inputCls} value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Name" /></Field>

          <div>
            <p className="mb-1.5 text-[12px] text-slate-500">Order, the same as LinkedIn&apos;s Sort by</p>
            <div className="flex flex-wrap gap-2">
              {SORTS.map((s) => <button key={s.id} type="button" className={pickClass(sort === s.id)} aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>{s.label}</button>)}
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
            <b>Limits to know:</b> LinkedIn shows at most {MAX_RESULT_PAGES * 10} results ({MAX_RESULT_PAGES} pages) per search on your connections. To reach more of your connections, run several campaigns with different filters.
            <p className="mt-1 text-[12px] text-slate-500">To stay gentle with your account, the sender reads at most {READ_PAGES_PER_DAY} pages a day, only when people are needed. The count shows as &quot;found so far&quot; on the campaign.</p>
          </div>
        </div>
      </Section>

      <Section title="2. What should we say?" icon="ti-message">
        <div className="space-y-3 px-4 py-3">
          <Field label="Message people get" hint={`Sent as a normal LinkedIn message, no invite. {first_name} and {link} work. ${connectedMessage.length} of ${MESSAGE_LIMIT} characters. {link} becomes the link to our web chat and is added at the end if you leave it out.`}>
            <textarea className={inputCls} rows={4} value={connectedMessage} onChange={(e) => setConnectedMessage(e.target.value)} />
          </Field>
          <p className="text-[13px]"><b>Sending as:</b> your connected LinkedIn account. People see that name.</p>
          <div role="radiogroup" aria-label="Where the chat continues" className="space-y-2">
            <p className="text-[13px] font-semibold text-slate-800">Where should the chat continue?</p>
            <Choice selected={handoff === "web_chat"} onSelect={() => setHandoff("web_chat")} title="Move to our web chat" badge={<span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">Recommended</span>}>
              The message includes a link. Johnny (investors) or Jessica (founders) qualifies and books the meeting. Lower account risk.
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
          <p className="text-[13px] text-slate-700">We start slowly and speed up over 3 weeks to protect the account. Starting approves the message above exactly as written. Change a word later and it needs approval again. You can stop any time.</p>
          <ErrorLine text={error} />
          <div className="flex gap-2">
            <button type="button" className={primaryCls} disabled={busy !== null} onClick={() => save(true)}>{busy === "start" ? "Starting…" : "Approve message and start"}</button>
            <button type="button" className={btnCls} disabled={busy !== null} onClick={() => save(false)}>{busy === "save" ? "Saving…" : "Save for later"}</button>
          </div>
        </div>
      </Section>
    </div>
  );
}
