"use client";

import { useEffect, useState } from "react";
import { DEFAULT_TITLES, FACET_KEYS, MAX_RESULT_PAGES, MAX_TITLES, MESSAGE_LIMIT, READ_PAGES_PER_DAY, matchKey, type FacetKey } from "@/lib/linkedin/limits";
import { MultiField } from "./MultiField";
import { Choice, ErrorLine, Field, Section, api, btnCls, inputCls, primaryCls } from "./ui";

type Who = "founder" | "investor";
type MatchView = { state: "none" | "pending" | "done" | "failed" | "unanswered"; key: string | null; total: number | null; detail: string | null; requestedAt: string | null; extensionOk: boolean };
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
/** The six filters that take several values, in the order LinkedIn lists them. */
const FACETS: Array<{ key: FacetKey; label: string; tag: string; list?: string; placeholder?: string }> = [
  { key: "industry", label: "Industry", tag: "Industry", list: "li-industries" },
  { key: "locations", label: "Locations", tag: "Locations", placeholder: "Paris, France" },
  { key: "currentCompany", label: "Current company", tag: "Current company" },
  { key: "pastCompany", label: "Past company", tag: "Past company" },
  { key: "school", label: "School", tag: "School" },
  { key: "profileLanguage", label: "Profile language", tag: "Language", list: "li-languages" },
];
const NO_FACETS: Record<FacetKey, string[]> = { industry: [], locations: [], currentCompany: [], pastCompany: [], school: [], profileLanguage: [] };
const SORTS = [{ id: "recent", label: "Recently added" }, { id: "first", label: "First name" }, { id: "last", label: "Last name" }] as const;

type Sort = (typeof SORTS)[number]["id"];

export function NewCampaignTab({ onSaved, onOpenSettings }: Readonly<{ onSaved: () => void; onOpenSettings: () => void }>) {
  const [name, setName] = useState("");
  const [facets, setFacets] = useState<Record<FacetKey, string[]>>(NO_FACETS);
  const [person, setPerson] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [who, setWho] = useState<Who>("founder");
  const [titles, setTitles] = useState<string[]>([...DEFAULT_TITLES.founder]);
  const [titleDraft, setTitleDraft] = useState("");
  const [match, setMatch] = useState<MatchView | null>(null);
  const [asking, setAsking] = useState(false);
  const [connectedMessage, setConnectedMessage] = useState(MESSAGES.founder);
  const [edited, setEdited] = useState(false);
  const [handoff, setHandoff] = useState<"web_chat" | "linkedin">("web_chat");
  const agent = AGENT[who];
  const [busy, setBusy] = useState<"save" | "start" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string): Record<string, string> => (v.trim() ? { [k]: v.trim() } : {});
  const facetFilters = Object.fromEntries(FACET_KEYS.filter((k) => facets[k].length > 0).map((k) => [k, facets[k]]));
  const filters = {
    ...facetFilters, ...set("name", person), sort,
    ...(titles.length > 0 ? { titles } : {}),
  };

  const key = matchKey({ ...facets, name: person });
  const waiting = match?.state === "pending";
  // Whether the extension has been asking iCapOS for work lately. Read on its own, so it also works from a phone while Chrome runs elsewhere.
  const [extensionOk, setExtensionOk] = useState<boolean | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    let alive = true;
    void api<MatchView>("/api/admin/linkedin/matches").then((r) => { if (alive && r.ok) setExtensionOk(r.data.extensionOk); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(async () => {
      const r = await api<MatchView>("/api/admin/linkedin/matches");
      if (r.ok) { setMatch(r.data); setExtensionOk(r.data.extensionOk); }
    }, 4000);
    const clock = setInterval(() => setNowMs(Date.now()), 1000);
    return () => { clearInterval(t); clearInterval(clock); };
  }, [waiting]);
  async function checkMatches() {
    setAsking(true);
    const r = await api<MatchView>("/api/admin/linkedin/matches", "POST", { filters: Object.fromEntries(Object.entries(filters).filter(([k]) => k !== "sort" && k !== "titles")) });
    setAsking(false);
    if (r.ok) { setMatch(r.data); setExtensionOk(r.data.extensionOk); setNowMs(Date.now()); } else setError(r.error);
  }
  // A count belongs to the filters it was made for. Change one and the number is cleared.
  const shown = match && match.key === key ? match : null;

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
    who === "founder" ? "Founders" : "Investors", "1st connections",
    ...FACETS.filter((f) => facets[f.key].length > 0).map((f) => `${f.tag}: ${facets[f.key].join(" or ")}`),
    person && `Name: ${person}`, titles.length > 0 && `Headline: ${titles.join(", ")}`, SORTS.find((x) => x.id === sort)?.label,
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
              {FACETS.map((f) => (
                <MultiField key={f.key} label={f.label} values={facets[f.key]} listId={f.list} placeholder={f.placeholder} onChange={(v) => setFacets((cur) => ({ ...cur, [f.key]: v }))} />
              ))}
            </div>
            <datalist id="li-industries">{INDUSTRIES.map((x) => <option key={x} value={x} />)}</datalist>
            <datalist id="li-languages">{LANGUAGES.map((x) => <option key={x} value={x} />)}</datalist>
            <p className="mt-1.5 text-[12px] text-slate-500">Type the first letters and press Enter to add a value. Add several to any filter: a person matches if they fit any one value of a filter, and every filter you fill in. The sender enters each value into LinkedIn and takes LinkedIn&apos;s closest match. If LinkedIn has no match, nothing is read and nobody is messaged. Several values in one filter need extension version 0.2.0 or newer.</p>
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

      <div id="li-step-2" className="scroll-mt-4">
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
      </div>

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
      <Section title="Matches on LinkedIn" icon="ti-brand-linkedin">
        <div className="space-y-2 px-4 py-3">
          {shown?.state === "done" ? (
            <div className="rounded-lg bg-emerald-50 px-3 py-2.5">
              <p className="text-[22px] font-semibold text-emerald-800">{shown.total === 0 ? "0 matches" : `About ${(shown.total ?? 0).toLocaleString("en-US")}`}</p>
              <p className="text-[12px] text-emerald-800">{shown.total === 0 ? "No connections match. Loosen a filter." : "of your 1st connections match these filters. Titles to keep will narrow this further."}</p>
            </div>
          ) : null}
          {shown?.state === "pending" ? <CheckingCard elapsed={elapsedSince(shown.requestedAt, nowMs)} /> : null}
          {shown?.state === "failed" ? <p className="text-[12.5px] text-red-700">Could not count: {shown.detail ?? "unknown reason"}.</p> : null}
          {shown?.state === "unanswered" ? <p className="text-[12.5px] text-amber-800">The extension did not answer. Open Chrome with the extension and a LinkedIn tab, then check again.</p> : null}
          {shown?.state !== "pending" && extensionOk === true ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-800"><i className="ti ti-circle-check" aria-hidden="true" />LinkedIn extension connected</span>
          ) : null}
          {shown?.state !== "pending" && extensionOk === false ? (
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-900"><i className="ti ti-alert-triangle" aria-hidden="true" />Extension not detected</span>
              <p className="text-[12.5px] text-slate-700">Open Chrome with the extension to see how many people match. You can still start the campaign without a count.</p>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className={primaryCls} onClick={onOpenSettings}>Get the extension</button>
                <a href="#li-step-2" className="text-[12.5px] font-medium text-[#1A6CE4] underline">Continue without a count</a>
              </div>
            </div>
          ) : null}
          {extensionOk !== false || shown?.state === "pending" ? (
            <button type="button" className={btnCls} disabled={asking || shown?.state === "pending"} aria-busy={asking || shown?.state === "pending"} onClick={checkMatches}>
              {asking || shown?.state === "pending" ? <><Spinner className="h-4 w-4" />Checking, please wait</> : shown?.state === "done" ? "Check again" : "Check how many match"}
            </button>
          ) : null}
          <p className="text-[11.5px] text-slate-500">Your extension runs the search on LinkedIn and reports back. Nothing is saved or sent. It uses one LinkedIn search.</p>
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

/** Whole seconds since the check was asked for, never below zero. */
function elapsedSince(iso: string | null, nowMs: number): number {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? Math.max(0, Math.floor((nowMs - t) / 1000)) : 0;
}

function Spinner({ className }: Readonly<{ className: string }>) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} motion-safe:animate-spin`}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="#cfdcfb" strokeWidth="3.5" />
      <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="#1A6CE4" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

/** Shown while the extension counts. A framed, moving card so it cannot be mistaken for an idle one. */
function CheckingCard({ elapsed }: Readonly<{ elapsed: number }>) {
  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <div role="status" aria-live="polite" className="li-checking space-y-2.5 rounded-xl border-2 border-[#1A6CE4] bg-[#F1F6FF] p-3">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes li-ring { 0%, 100% { box-shadow: 0 0 0 0 rgba(26,108,228,.35); } 50% { box-shadow: 0 0 0 6px rgba(26,108,228,0); } }
          @keyframes li-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(320%); } }
          .li-checking { animation: li-ring 1.8s ease-in-out infinite; }
          .li-bar { animation: li-slide 1.4s ease-in-out infinite; }
        }
      `}</style>
      <div className="flex items-center gap-2.5">
        <Spinner className="h-6 w-6" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-blue-900">Checking LinkedIn now</p>
          <p className="text-[12px] text-slate-600">Usually under 2 minutes</p>
        </div>
        <span className="text-[16px] font-semibold tabular-nums text-blue-900">{mm}:{ss}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-blue-100"><div className="li-bar h-2 w-1/3 rounded-full bg-[#1A6CE4]" /></div>
      <ul className="space-y-1 text-[12.5px] text-slate-700">
        <li className="flex items-center gap-2"><i className="ti ti-circle-check text-emerald-700" aria-hidden="true" />Request sent to your extension</li>
        <li className="flex items-center gap-2 font-medium"><Spinner className="h-4 w-4" />Waiting for LinkedIn&apos;s count</li>
      </ul>
    </div>
  );
}
