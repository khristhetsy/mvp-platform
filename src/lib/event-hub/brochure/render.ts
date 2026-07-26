// Event Brochure — booklet HTML renderer (build spec §5/§8). One renderer feeds
// the on-screen preview and (next pass) the PDF export, so they never drift.
// Locked pages/copy (disclaimers, footer lockup, compliance) are hard-coded and
// read no override key — the print expression of the "event ≠ offer" wall.

import type { EventMergeData } from "@/lib/event-email/merge";
import type { BrochurePage, BrochureSize } from "./types";

const NAVY = "#0c2340";
const esc = (s: string) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const PAGE_DIMS: Record<BrochureSize, { w: string; h: string }> = {
  letter: { w: "8.5in", h: "11in" },
  a4: { w: "210mm", h: "297mm" },
  square: { w: "8in", h: "8in" },
};

const DISCLAIMERS = [
  "This booklet is provided for education and community purposes only.",
  "Nothing in this booklet is an offer to sell or a solicitation of an offer to buy any security, nor a recommendation of any security or investment strategy.",
  "iCFO Capital Global, Inc. is not a broker-dealer, placement agent, or registered investment adviser. No funding outcome is promised or implied.",
  "Presenting companies and sponsors are responsible for their own statements. Participation does not constitute an endorsement.",
  "Prospective investors should consult their own legal, tax, and financial advisers before making any investment decision.",
];

/** override ?? merge value (Tier-1/2). Locked pages ignore overrides entirely. */
function ov(overrides: Record<string, Record<string, string>>, key: string, field: string, fallback: string): string {
  return overrides?.[key]?.[field] ?? fallback;
}

function frame(inner: string, pageNo: number, showFooter: boolean): string {
  const footer = showFooter
    ? `<div class="bk-footer"><span>iCapOS · Powered by iCFO Capital Global, Inc.</span><span>${pageNo}</span></div>`
    : "";
  return `<section class="bk-page">${inner}${footer}</section>`;
}

function coverPage(m: EventMergeData, o: Record<string, Record<string, string>>): string {
  const bg = m.bannerUrl
    ? `background-image:linear-gradient(135deg,rgba(12,35,64,.82),rgba(12,35,64,.68)),url('${esc(m.bannerUrl)}');background-size:cover;background-position:center;`
    : `background:${NAVY};`;
  return `<div class="bk-cover" style="${bg}">
    <div class="bk-cover-badge">${esc(m.badge)}</div>
    <div class="bk-cover-title">${esc(ov(o, "cover", "title", m.title))}</div>
    <div class="bk-cover-tag">${esc(ov(o, "cover", "tagline", m.tagline))}</div>
    <div class="bk-cover-date">${esc(m.dateLabel)}${m.timeRange ? ` · ${esc(m.timeRange)}` : ""}</div>
  </div>`;
}

function disclaimersPage(): string {
  return `<div class="bk-body"><h2 class="bk-h2">Disclaimers &amp; Important Notices</h2>
    ${DISCLAIMERS.map((d) => `<p class="bk-disc">${esc(d)}</p>`).join("")}</div>`;
}

function contentsPage(items: { n: number; label: string }[]): string {
  return `<div class="bk-body"><h2 class="bk-h2">Contents</h2>
    ${items.map((i) => `<div class="bk-toc"><span>${esc(i.label)}</span><span class="bk-dots"></span><span>${i.n}</span></div>`).join("")}</div>`;
}

function introPage(m: EventMergeData, o: Record<string, Record<string, string>>): string {
  const body = ov(o, "introduction", "body", m.tagline || "Welcome to the iCFO event.");
  return `<div class="bk-body"><h2 class="bk-h2">Introduction</h2>
    <p class="bk-p">${esc(body)}</p>
    <p class="bk-p">${esc(ov(o, "introduction", "audience", "Attendees include accredited investors, family offices, venture capitalists, and investment professionals across multiple industries."))}</p></div>`;
}

function agendaPage(m: EventMergeData): string {
  const rows = m.sessions.length
    ? m.sessions.map((s) => `<div class="bk-agenda"><span class="bk-agenda-type" style="color:${s.accent}">${esc(s.type.replace(/_/g, " "))}</span>
        <div><div class="bk-agenda-title">${esc(s.title)}</div>${s.abstract ? `<div class="bk-agenda-abs">${esc(s.abstract)}</div>` : ""}</div></div>`).join("")
    : `<p class="bk-p">Agenda to be announced.</p>`;
  return `<div class="bk-body"><h2 class="bk-h2">Agenda</h2><div class="bk-agenda-date">${esc(m.dateLabel)}${m.timeRange ? ` · ${esc(m.timeRange)}` : ""}</div>${rows}</div>`;
}

function presentersPages(m: EventMergeData): string {
  if (!m.presenters.length) return "";
  // 6 per page
  const pages: string[] = [];
  for (let i = 0; i < m.presenters.length; i += 6) {
    const chunk = m.presenters.slice(i, i + 6);
    const cards = chunk.map((p) => `<div class="bk-pres">
      <div class="bk-pres-av">${p.headshotUrl ? `<img src="${esc(p.headshotUrl)}" alt="">` : esc(p.initials)}</div>
      <div class="bk-pres-nm">${esc(p.name)}</div>
      ${p.role ? `<div class="bk-pres-rl">${esc(p.role)}</div>` : ""}
      ${p.company ? `<div class="bk-pres-co">${esc(p.company)}</div>` : ""}
    </div>`).join("");
    pages.push(`<div class="bk-body"><h2 class="bk-h2">Presenters${i > 0 ? " (cont.)" : ""}</h2><div class="bk-pres-grid">${cards}</div></div>`);
  }
  return pages.join("|||");
}

function teamPage(): string {
  return `<div class="bk-body"><h2 class="bk-h2">MC &amp; Event Team</h2>
    <p class="bk-p">Hosted and produced by the iCFO Capital Global events team. Master of ceremonies and coordinators are introduced on stage.</p></div>`;
}

function sponsorsContactPage(m: EventMergeData): string {
  const tier = (label: string, list: { name: string; logoUrl: string | null }[]) =>
    list.length ? `<div class="bk-spon-tier"><div class="bk-spon-tier-h">${esc(label)}</div><div class="bk-spon-row">${list.map((s) => `<span class="bk-spon">${esc(s.name)}</span>`).join("")}</div></div>` : "";
  return `<div class="bk-body"><h2 class="bk-h2">Sponsors</h2>
    ${tier("Presenting partners", m.sponsorTiers.presenting)}
    ${tier("Track sponsors", m.sponsorTiers.track)}
    ${tier("Community", m.sponsorTiers.community)}
    ${!m.sponsorTiers.presenting.length && !m.sponsorTiers.track.length && !m.sponsorTiers.community.length ? `<p class="bk-p">Sponsor lineup to be announced.</p>` : ""}
    <h2 class="bk-h2" style="margin-top:24px">Contact</h2>
    <p class="bk-p">${esc(m.organizerLine)}</p></div>`;
}

function customPage(page: BrochurePage): string {
  const c = page.custom ?? { layout: "text" as const };
  const img = c.imageUrl ? `<img class="bk-custom-img" src="${esc(c.imageUrl)}" alt="">` : "";
  const text = `${c.heading ? `<h2 class="bk-h2">${esc(c.heading)}</h2>` : ""}${c.body ? `<p class="bk-p">${esc(c.body)}</p>` : ""}`;
  if (c.layout === "full_image") return `<div class="bk-body bk-full">${img}</div>`;
  if (c.layout === "text_image") return `<div class="bk-body">${text}${img}</div>`;
  return `<div class="bk-body">${text}</div>`;
}

/** Render the whole booklet to a print-ready HTML document. */
export function renderBookletHTML(
  pages: BrochurePage[],
  merge: EventMergeData,
  overrides: Record<string, Record<string, string>>,
  size: BrochureSize,
): string {
  const dims = PAGE_DIMS[size];
  const included = pages.filter((p) => p.included);

  // Build contents entries (numbered by final order, excluding cover=1/disclaimers).
  const tocItems: { n: number; label: string }[] = [];
  included.forEach((p, i) => {
    if (p.type === "cover" || p.type === "disclaimers" || p.type === "contents") return;
    tocItems.push({ n: i + 1, label: labelFor(p) });
  });

  const sections: string[] = [];
  let pageNo = 0;
  for (const p of included) {
    pageNo += 1;
    const inner = renderOne(p, merge, overrides, tocItems);
    // presenters may return multiple pages joined by |||
    if (p.type === "presenters" && inner.includes("|||")) {
      const parts = inner.split("|||");
      parts.forEach((part, idx) => {
        sections.push(frame(part, idx === 0 ? pageNo : (pageNo += 1), true));
      });
    } else {
      const showFooter = p.type !== "cover";
      sections.push(frame(inner, pageNo, showFooter));
    }
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: ${dims.w} ${dims.h}; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #1e2a3a; background: #dfe3ea; }
    .bk-page { position: relative; width: ${dims.w}; height: ${dims.h}; background: #fff; margin: 0 auto 14px; overflow: hidden; page-break-after: always; box-shadow: 0 6px 20px rgba(12,35,64,.12); }
    .bk-cover { width: 100%; height: 100%; color: #fff; display: flex; flex-direction: column; justify-content: flex-end; padding: 0.9in 0.8in; }
    .bk-cover-badge { font-family: Arial, sans-serif; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: #9fd0ff; }
    .bk-cover-title { font-size: 40px; font-weight: bold; line-height: 1.1; margin-top: 10px; }
    .bk-cover-tag { font-size: 16px; color: #d7e4f5; margin-top: 10px; }
    .bk-cover-date { font-family: Arial, sans-serif; font-size: 14px; color: #eaf1fb; margin-top: 16px; font-weight: bold; }
    .bk-body { padding: 0.85in 0.8in 0.9in; }
    .bk-full { padding: 0; }
    .bk-h2 { font-size: 22px; color: ${NAVY}; margin: 0 0 14px; border-bottom: 2px solid ${NAVY}; padding-bottom: 6px; }
    .bk-p { font-size: 13.5px; line-height: 1.6; margin: 0 0 12px; }
    .bk-disc { font-size: 11.5px; line-height: 1.55; color: #4a5568; margin: 0 0 9px; }
    .bk-toc { display: flex; align-items: baseline; font-size: 13.5px; padding: 6px 0; }
    .bk-dots { flex: 1; border-bottom: 1px dotted #9aa6bd; margin: 0 8px; transform: translateY(-3px); }
    .bk-agenda-date { font-family: Arial, sans-serif; font-size: 12px; color: #6a7690; margin-bottom: 12px; }
    .bk-agenda { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #e2e8f2; }
    .bk-agenda-type { font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; letter-spacing: .05em; text-transform: uppercase; min-width: 90px; }
    .bk-agenda-title { font-size: 14px; font-weight: bold; color: ${NAVY}; }
    .bk-agenda-abs { font-size: 12px; color: #4a5568; margin-top: 3px; }
    .bk-pres-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .bk-pres { text-align: center; }
    .bk-pres-av { width: 74px; height: 74px; border-radius: 50%; background: ${NAVY}; color: #fff; font-family: Arial, sans-serif; font-size: 22px; font-weight: bold; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px; overflow: hidden; }
    .bk-pres-av img { width: 100%; height: 100%; object-fit: cover; }
    .bk-pres-nm { font-size: 14px; font-weight: bold; color: ${NAVY}; }
    .bk-pres-rl { font-size: 12px; color: #4a5568; }
    .bk-pres-co { font-size: 11.5px; color: #6a7690; }
    .bk-spon-tier { margin-bottom: 14px; }
    .bk-spon-tier-h { font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; letter-spacing: .05em; text-transform: uppercase; color: #6a7690; margin-bottom: 6px; }
    .bk-spon-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .bk-spon { font-size: 13px; font-weight: bold; color: ${NAVY}; background: #f2f6fc; padding: 6px 12px; border-radius: 6px; }
    .bk-custom-img { width: 100%; border-radius: 6px; margin-top: 10px; }
    .bk-full .bk-custom-img { border-radius: 0; height: 100%; object-fit: cover; }
    .bk-footer { position: absolute; bottom: 0.4in; left: 0.8in; right: 0.8in; display: flex; justify-content: space-between; font-family: Arial, sans-serif; font-size: 10px; color: #8a93a6; border-top: 1px solid #e2e8f2; padding-top: 6px; }
  </style></head><body>${sections.join("")}</body></html>`;
}

function labelFor(p: BrochurePage): string {
  if (p.type === "custom") return p.custom?.heading || "Custom page";
  const map: Record<string, string> = {
    contents: "Contents", introduction: "Introduction", agenda: "Agenda",
    presenters: "Presenters", team: "MC & Team", sponsors_contact: "Sponsors & Contact",
  };
  return map[p.type] ?? p.type;
}

function renderOne(
  p: BrochurePage,
  m: EventMergeData,
  o: Record<string, Record<string, string>>,
  toc: { n: number; label: string }[],
): string {
  switch (p.type) {
    case "cover": return coverPage(m, o);
    case "disclaimers": return disclaimersPage();
    case "contents": return contentsPage(toc);
    case "introduction": return introPage(m, o);
    case "agenda": return agendaPage(m);
    case "presenters": return presentersPages(m) || `<div class="bk-body"><h2 class="bk-h2">Presenters</h2><p class="bk-p">Presenter lineup to be announced.</p></div>`;
    case "team": return teamPage();
    case "sponsors_contact": return sponsorsContactPage(m);
    case "custom": return customPage(p);
    default: return `<div class="bk-body"></div>`;
  }
}
