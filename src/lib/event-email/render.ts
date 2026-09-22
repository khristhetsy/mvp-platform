// Event Email — renderer (build spec §6). Produces email-safe 600px HTML from
// EventMergeData. The SAME function feeds live preview and send (no drift, §7).
// The compliance footer is hard-coded and cannot be toggled off (§5, "event ≠ offer").

import type { EventMergeData, EventEmailType } from "./merge";
import { buildAgenda, type AgendaRow } from "./agenda";
import {
  accentFor, BLUE, BODY, CARD_BG, INK, LINE, MUTED, NAVY, TINT, TINT_LINE,
  type SessionWeight,
} from "./palette";
import {
  chunk,
  companyLine,
  personLine,
  pitchLine,
  rosterSections,
  sessionGuests,
  type RosterPerson,
} from "./roster";

export type RenderOptions = {
  type: EventEmailType;
  includeBanner?: boolean;
  includeLobby?: boolean;
  /** The who's-presenting sections. Default on. */
  includeRoster?: boolean;
  logoUrl?: string;
  /** For the 'booklet' type — link to the digital brochure PDF. */
  bookletUrl?: string;
  /** Optional personal note rendered above the hero (merged-booklet distribute). */
  coverNote?: string;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Hard-coded compliance footer — email-side "event ≠ offer" wall (§5). */
const COMPLIANCE = `iCFO events are for education and community only. Nothing in this email is an offer to sell or a solicitation to buy any security. iCFO Capital Global, Inc. is not a broker-dealer, placement agent, or registered investment adviser, and no funding outcome is promised.`;

function ctaButton(href: string, label: string, primary: boolean): string {
  const bg = primary ? BLUE : "#ffffff";
  const color = primary ? "#ffffff" : NAVY;
  const border = primary ? BLUE : "#d5deea";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0;"><tr><td style="border-radius:8px;background:${bg};border:1px solid ${border};">
    <a href="${esc(href)}" style="display:inline-block;padding:12px 22px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:${color};text-decoration:none;">${esc(label)}</a>
  </td></tr></table>`;
}

/** The badge in the fixed left column. Fixed width so the titles line up. */
function badge(label: string, weight: SessionWeight): string {
  const { bg, fg } = accentFor(weight);
  return `<td width="78" valign="top" style="width:78px;padding:2px 10px 0 0;">
    <div style="background:${bg};color:${fg};font-family:Arial,sans-serif;font-size:9px;font-weight:bold;letter-spacing:.07em;text-transform:uppercase;text-align:center;border-radius:3px;padding:4px 2px;">${esc(label)}</div>
  </td>`;
}

/** Whoever is billed under a session, named with it. */
function billingLine(sessionId: string, roster: RosterPerson[]): string {
  const billed = sessionId ? sessionGuests(roster, sessionId) : [];
  if (!billed.length) return "";
  return `<div style="margin-top:6px;font-family:Arial,sans-serif;font-size:11.5px;color:#40546f;line-height:1.6;">${billed
    .slice(0, 3)
    .map((g) => `<span style="color:${MUTED};">${esc(g.role)}</span> <strong style="color:${INK};">${esc(g.person.name)}</strong>${g.person.company ? `, ${esc(g.person.company)}` : ""}`)
    .join(" &nbsp;·&nbsp; ")}</div>`;
}

/**
 * One agenda row: badge, title, at most a line of abstract, and the people
 * billed under it — the draw of a talk show is who is in the chair, and that
 * belongs with the session rather than in a list further down.
 *
 * The lead row is the same shape on a tint. Billing renders on any session
 * that has guests, not just the lead, so a single-session event keeps it.
 */
function sessionRow(r: AgendaRow, roster: RosterPerson[], featured: boolean): string {
  const inner = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      ${badge(r.label, featured ? "lead" : r.weight)}
      <td valign="top" style="font-family:Arial,sans-serif;">
        <div style="font-size:${featured ? 15 : 14}px;font-weight:bold;color:${NAVY};line-height:1.3;">${esc(r.session.title)}</div>
        ${r.abstract ? `<div style="font-size:${featured ? 12.5 : 12}px;color:${BODY};line-height:1.5;margin-top:${featured ? 3 : 2}px;">${esc(r.abstract)}</div>` : ""}
        ${billingLine(r.session.id, roster)}
      </td>
    </tr></table>`;
  return featured
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;background:${TINT};border:1px solid ${TINT_LINE};border-radius:8px;">
        <tr><td style="padding:11px 12px;">${inner}</td></tr></table>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #f1f4f9;">
        <tr><td style="padding:9px 0;">${inner}</td></tr></table>`;
}

/** Booth sessions, merged to one row naming the companies. */
function exhibitRow(names: string[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:9px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      ${badge("Exhibits", "aside")}
      <td valign="top" style="font-family:Arial,sans-serif;">
        <div style="font-size:13.5px;font-weight:bold;color:${NAVY};line-height:1.35;">${esc(names.join(" · "))}</div>
      </td>
    </tr></table></td></tr></table>`;
}

/**
 * The agenda. Abstracts are trimmed to a line here and stay whole on the event
 * page — an agenda in an email says what is on, not what it is about.
 */
function agendaBlock(merge: EventMergeData): string {
  if (!merge.sessions.length) return "";
  const { lead, rows, exhibits } = buildAgenda(merge.sessions);
  const count = merge.sessions.length;
  return `<div style="font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};margin:6px 0 9px;">Agenda · ${count} ${count === 1 ? "session" : "sessions"}</div>
    ${lead ? sessionRow(lead, merge.presenters, true) : ""}
    ${rows.map((r) => sessionRow(r, merge.presenters, false)).join("")}
    ${exhibits.length ? exhibitRow(exhibits) : ""}`;
}

/**
 * One row of up to three cells. Real table columns, not CSS grid — Outlook on
 * Windows lays the former out and ignores the latter.
 */
function columnRow(
  people: RosterPerson[],
  opts: { bg: string; border: string; titleSize: number; textSize: number; withRole: boolean; withPitch: boolean },
): string {
  const width = Math.floor(100 / 3);
  const cells = people
    .map((p) => {
      const second = [personLine(p, opts.withRole), opts.withPitch ? pitchLine(p) : ""].filter(Boolean).join(" — ");
      return `<td width="${width}%" valign="top" style="width:${width}%;padding:0 5px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${opts.bg};border:1px solid ${opts.border};border-radius:8px;"><tr>
          <td style="padding:11px 11px 12px;font-family:Arial,sans-serif;">
            <div style="font-size:${opts.titleSize}px;font-weight:bold;color:${NAVY};line-height:1.25;">${esc(companyLine(p))}</div>
            ${second ? `<div style="font-size:${opts.textSize}px;color:${MUTED};line-height:1.4;margin-top:3px;">${esc(second)}</div>` : ""}
          </td>
        </tr></table>
      </td>`;
    })
    .join("");
  // A short last row keeps the grid square rather than stretching its cells.
  const filler = Array.from({ length: 3 - people.length })
    .map(() => `<td width="${width}%" style="width:${width}%;"></td>`)
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;"><tr>${cells}${filler}</tr></table>`;
}

/**
 * Who's presenting: companies lead on a tinted band, Founder Showcase sits
 * quieter beneath, exhibitors get a line. A group with nobody in it renders
 * nothing at all — no heading, no empty state.
 */
function rosterBlock(merge: EventMergeData): string {
  const { companies, showcase, exhibitors } = rosterSections(merge.presenters);
  if (!companies.length && !showcase.length && !exhibitors.length) return "";

  const feature = companies.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;background:${TINT};border:1px solid ${TINT_LINE};border-radius:10px;">
        <tr><td style="padding:16px 12px 8px;font-family:Arial,sans-serif;">
          <div style="font-size:10px;font-weight:bold;letter-spacing:.11em;text-transform:uppercase;color:${BLUE};padding:0 5px;">On the programme</div>
          <div style="font-size:20px;font-weight:bold;color:${NAVY};line-height:1.2;margin-top:3px;padding:0 5px;">Presenting companies</div>
          <div style="font-size:12px;color:#40546f;line-height:1.5;margin:5px 0 12px;padding:0 5px;">${companies.length} ${companies.length === 1 ? "company" : "companies"} presenting to the room.</div>
          ${chunk(companies, 3)
            .map((row) => columnRow(row, { bg: "#ffffff", border: TINT_LINE, titleSize: 14, textSize: 11, withRole: true, withPitch: false }))
            .join("")}
        </td></tr></table>`
    : "";

  const quiet = showcase.length
    ? `<div style="font-family:Arial,sans-serif;margin:20px 0 0;">
        <div style="font-size:13px;font-weight:bold;color:#40546f;">Founder Showcase</div>
        <div style="font-size:11px;color:${MUTED};line-height:1.5;margin:2px 0 9px;">${showcase.length} ${showcase.length === 1 ? "company" : "companies"} pitching live from the main stage.</div>
      </div>${chunk(showcase, 3)
        // Role is dropped at a third of the width — the pitch line is worth more.
        .map((row) => columnRow(row, { bg: CARD_BG, border: LINE, titleSize: 12, textSize: 10, withRole: false, withPitch: true }))
        .join("")}`
    : "";

  const booths = exhibitors.length
    ? `<div style="font-family:Arial,sans-serif;margin:18px 0 0;">
        <div style="font-size:12px;font-weight:bold;color:${MUTED};">Exhibitors</div>
        <div style="font-size:12px;color:${BODY};line-height:1.7;margin-top:3px;">${esc(exhibitors.map(companyLine).join(" · "))}</div>
      </div>`
    : "";

  return `${feature}${quiet}${booths}`;
}

export function renderEventEmail(merge: EventMergeData, options: RenderOptions): string {
  const dayOf = options.type === "day_of";
  const booklet = options.type === "booklet";
  const lobbyPrimary = dayOf || Boolean(options.includeLobby);
  const showBanner = options.includeBanner !== false && Boolean(merge.bannerUrl);
  const logo = options.logoUrl || "https://icapos.com/email-logo-2x.png";
  const bookletUrl = options.bookletUrl || merge.bookletUrl || merge.registerUrl;

  const bottomCta =
    options.type === "reminder"
      ? "Three days to go — register now →"
      : dayOf
        ? "We're live today — enter the lobby ↗"
        : booklet
          ? "Download the event booklet ↓"
          : `See you ${merge.dateLabel || "there"} →`;

  const heroInner = `
    <div style="font-family:Arial,sans-serif;color:#ffffff;padding:34px 30px;">
      <div style="font-size:11px;font-weight:bold;letter-spacing:.12em;text-transform:uppercase;color:#9fd0ff;">${esc(merge.badge)}</div>
      <div style="font-size:26px;font-weight:bold;line-height:1.2;margin-top:8px;">${esc(merge.title)}</div>
      ${merge.tagline ? `<div style="font-size:14px;color:#cfe0f5;line-height:1.5;margin-top:8px;">${esc(merge.tagline)}</div>` : ""}
      <div style="font-size:13px;color:#e7eefaff;margin-top:14px;font-weight:bold;">${esc(merge.dateLabel)}${merge.timeRange ? ` · ${esc(merge.timeRange)}` : ""}</div>
      <div style="font-size:12px;color:#b9cbe6;margin-top:2px;">${esc(merge.formatLine)}</div>
    </div>`;

  const hero = showBanner
    ? `<td background="${esc(merge.bannerUrl as string)}" bgcolor="${NAVY}" valign="top" style="background-image:linear-gradient(135deg,rgba(10,26,64,.86),rgba(10,26,64,.7)),url('${esc(merge.bannerUrl as string)}');background-size:cover;background-position:center;">${heroInner}</td>`
    : `<td bgcolor="${NAVY}" valign="top" style="background:${NAVY};">${heroInner}</td>`;

  const registerBtn = booklet
    ? ctaButton(bookletUrl, "Download the booklet (PDF) ↓", true)
    : ctaButton(merge.registerUrl, options.type === "reminder" ? "Register now →" : "Register to attend →", !lobbyPrimary);
  const lobbyBtn = booklet
    ? ctaButton(merge.registerUrl, "Register to attend →", false)
    : (lobbyPrimary || options.includeLobby)
      ? ctaButton(merge.lobbyUrl, "Enter lobby ↗", lobbyPrimary)
      : "";

  const sessionsBlock = agendaBlock(merge);

  const rosterHtml = options.includeRoster === false ? "" : rosterBlock(merge);

  const sponsorRow = merge.sponsorLockup
    ? `<div style="font-family:Arial,sans-serif;font-size:12px;color:${MUTED};margin:14px 0 0;">${esc(merge.sponsorLockup)}</div>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(merge.title)}</title></head>
<body style="margin:0;padding:0;background:#eef1f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:20px 0;"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f2;">
      <tr><td style="padding:16px 30px;font-family:Arial,sans-serif;"><img src="${esc(logo)}" alt="iCapOS" height="26" style="height:26px;"></td></tr>
      ${options.coverNote?.trim() ? `<tr><td style="padding:0 30px 16px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#33415a;">${esc(options.coverNote.trim()).replace(/\n/g, "<br>")}</td></tr>` : ""}
      <tr>${hero}</tr>
      <tr><td style="padding:24px 30px;font-family:Arial,sans-serif;">
        ${registerBtn}
        ${lobbyBtn}
        <div style="height:8px;"></div>
        ${sessionsBlock}
        ${rosterHtml}
        ${sponsorRow}
        <div style="height:18px;"></div>
        ${ctaButton(booklet ? bookletUrl : lobbyPrimary ? merge.lobbyUrl : merge.registerUrl, bottomCta, true)}
      </td></tr>
      <tr><td style="padding:18px 30px;border-top:1px solid #e2e8f2;font-family:Arial,sans-serif;">
        <div style="font-size:12px;color:#33415a;">${esc(merge.organizerLine)}</div>
        <div style="font-size:11px;color:#8a93a6;line-height:1.5;margin-top:10px;">${esc(COMPLIANCE)}</div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}
