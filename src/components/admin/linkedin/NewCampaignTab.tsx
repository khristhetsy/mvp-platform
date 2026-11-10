"use client";

import { useState } from "react";
import { DEFAULT_TITLES, MAX_RESULT_PAGES, MAX_TITLES, MESSAGE_LIMIT, READ_PAGES_PER_DAY } from "@/lib/linkedin/limits";
import { Choice, ErrorLine, Field, Section, api, btnCls, inputCls, primaryCls } from "./ui";

type Who = "founder" | "investor";
// Drafts for you to read and edit. Nothing sends until you approve the exact text.
const MESSAGES: Record<Who, string> = {
  founder: "Hi {first_name}, it has been a while. I now run iCapOS, which helps founders measure how ready they are for investors and meet the right ones. Our AI assistant Jessica can give you a readiness check in 2 minutes and book a call with our team: {link}",
  investor: "Hi {first_name}, it has been a while. I now run iCapOS, where founders are rated for capital readiness before they reach investors. Our AI assistant Johnny can explain how it works and book a call with our team: {link}",
};
const AGENT: Record<Who, { id: "jessica" | "johnny"; name: string; label: string }> = {
  founder: { id: "jessica", name: "Jessica", label: "Jessica (founders)" },
  investor: { id: "johnny", name: "Johnny", label: "Johnny (investors)" },
};

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
  const [who, setWho] = useState<Who>("founder");
  const [titles, setTitles] = useState<string[]>([...DEFAULT_TITLES.founder]);
  const [titleDraft, setTitleDraft] = useState("");
  const [connectedMessage, setConnectedMessage] = useState(MESSAGES.founder);
  const [edited, setEdited] = useState(false);
  const [handoff, setHandoff] = useState<"web_chat" | "linkedin">("web_chat");
  const agent = AGENT[who];
  const [busy, setBusy] = useState<"save" | "start" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string): Record<string, string> => (v.trim() ? { [k]: v.trim() } : {});
  const filters = {
    ...set("industry", industry), ...set("locations", locations), ...set("currentCompany", currentCompany), ...set("pastCompany", pastCompany),
    ...set("school", school), ...set("profileLanguage", profileLanguage), ...set("name", person), sort,
    ...(titles.length > 0 ? { titles } : {}),
  };

  function pickWho(next: Who) {
    if (next === who) return;
    if (edited && !window.confirm(`Replace your edited message with the ${next === "founder" ? "founders" : "investors"} version?`)) return;
    setWho(next); setEdited(false); setConnectedMessage(MESSAGES[next]); setTitles([...DEFAULT_TITLES[next]]);
  }
  function addTitle() {
    const t = titleDraft.replace(/\s+/g, " ").trim().slice(0, 30);
    setTitleDraft("");
    if (t && titles.length < MAX_TITLES && !titles.some((x) => x.toLowerCase() === t.toLowerCase())) setTitles([...titles, t]);
  }

  const link = handoff === "web_chat" ? `icapos.com/${agent.id}` : null;
  const previewText = (() => {
    const t = connectedMessage.replaceAll("{first_name}", "Sam");
    if (!link) return t.replaceAll("{link}", "").trim();
    return t.includes("{link}") ? t.replaceAll("{link}", link) : `${t.trim()} ${link}`;
  })();
  const filterTags = [
    who === "founder" ? "Founders" : "Investors", "1st connections", industry && `Industry: ${industry}`, locations && `Locations: ${locations}`,
    currentCompany && `Current company: ${currentCompany}`, pastCompany && `Past company: ${pastCompany}`, school && `School: ${school}`,
    profileLanguage && `Language: ${profileLanguage}`, person && `Name: ${person}`, titles.length > 0 && `Headline: ${titles.join(", ")}`, SORTS.find((x) => x.id === sort)?.label,
  ].filter((x): x is string => !!x);

  async function save(thenStart: boolean) {
    if (!name.trim()) { setError("Give the campaign a name."); return; }
    if (!connectedMessage.trim()) { setError("Write the message people get."); return; }
    setBusy(thenStart ? "start" : "save"); setError(null);
    const created = await api<{ campaign: { id: string } }>("/api/admin/linkedin/campaigns", "POST", {
      name: name.trim(), audience: { source: "linkedin_network", filters: { ...filters, module: who } }, invite_variants: [], message_text: null,
      connected_message_text: connectedMessage, handoff_mode: handoff, agent: agent.id,
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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
    <div className="space-y-4">
      <Section title="1. Who do you want to reach?" icon="ti-users">
        <div className="space-y-3 px-4 py-3">
          <Field label="Campaign name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Reconnect with my network" /></Field>

          <div>
            <p className="mb-1.5 text-[12px] text-slate-500">I am reaching out to</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Who you are reaching out to">
              <button type="button" role="radio" aria-checked={who === "founder"} className={pickClass(who === "founder")} onClick={() => pickWho("founder")}>Founders</button>
              <button type="button" role="radio" aria-checked={who === "investor"} className={pickClass(who === "investor")} onClick={() => pickWho("investor")}>Investors</button>
            </div>
            <p className="mt-1.5 text-[12px] text-slate-500">This sets the message below and the AI assistant they chat with: Jessica for founders, Johnny for investors. LinkedIn has no founder or investor filter, so you narrow the group with the filters below.</p>
          </div>

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

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-[13px] font-medium text-blue-900">Titles to keep</p>
            <p className="mb-2 text-[12px] text-slate-600">Only message people whose LinkedIn headline says one of these words. Filled in for you, edit freely. Remove them all to message everyone the filters find.</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {titles.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2.5 py-0.5 text-[12px] text-blue-800">
                  {t}
                  <button type="button" aria-label={`Remove ${t}`} className="text-blue-500 hover:text-blue-800" onClick={() => setTitles(titles.filter((x) => x !== t))}>×</button>
                </span>
              ))}
            </div>
            <input className={inputCls} value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTitle(); } }} onBlur={addTitle} placeholder="Add a word, press Enter" />
          </div>

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
            <textarea className={inputCls} rows={5} value={connectedMessage} onChange={(e) => { setConnectedMessage(e.target.value); setEdited(true); }} />
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
          <Field label="Chat agent" hint="Follows your choice of founders or investors in step 1."><input className={inputCls} value={agent.label} readOnly /></Field>
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
    <aside className="space-y-4 lg:sticky lg:top-4" aria-label="Preview">
      <Section title="Preview" icon="ti-eye">
        <div className="space-y-2 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-[13px] font-semibold text-white">K</span>
            <div><p className="text-[13px] font-semibold text-slate-900">Khris Thetsy</p><p className="text-[11.5px] text-slate-500">Sent from your LinkedIn account</p></div>
          </div>
          <p className="text-[11.5px] text-slate-500">Preview for a sample person named Sam</p>
          <div className="whitespace-pre-wrap break-words rounded-xl rounded-bl-sm bg-blue-50 px-3 py-2.5 text-[13px] leading-relaxed text-slate-800">{previewText || "Your message appears here."}</div>
          <p className="text-[11.5px] text-slate-500">{link ? `The link opens our web chat with ${agent.name}, our AI assistant.` : "No link: the chat stays inside LinkedIn."}</p>
        </div>
      </Section>
      <Section title="Who this reaches" icon="ti-users">
        <div className="space-y-2 px-4 py-3">
          <div className="flex flex-wrap gap-1.5">{filterTags.map((t) => <span key={t} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11.5px] text-slate-700">{t}</span>)}</div>
          <p className="text-[11.5px] text-slate-500">Message length: {connectedMessage.length} characters. The number of people shows as &quot;found so far&quot; once the sender has read pages.</p>
        </div>
      </Section>
    </aside>
    </div>
  );
}
