// Event Email — renderer (build spec §6). Produces email-safe 600px HTML from
// EventMergeData. The SAME function feeds live preview and send (no drift, §7).
// The compliance footer is hard-coded and cannot be toggled off (§5, "event ≠ offer").

import type { EventMergeData, EventEmailType } from "./merge";

export type RenderOptions = {
  type: EventEmailType;
  includeBanner?: boolean;
  includeLobby?: boolean;
  logoUrl?: string;
  /** For the 'booklet' type — link to the digital brochure PDF. */
  bookletUrl?: string;
  /** Optional personal note rendered above the hero (merged-booklet distribute). */
  coverNote?: string;
};

const NAVY = "#0c2340";
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Hard-coded compliance footer — email-side "event ≠ offer" wall (§5). */
const COMPLIANCE = `iCFO events are for education and community only. Nothing in this email is an offer to sell or a solicitation to buy any security. iCFO Capital Global, Inc. is not a broker-dealer, placement agent, or registered investment adviser, and no funding outcome is promised.`;

function ctaButton(href: string, label: string, primary: boolean): string {
  const bg = primary ? "#2E78F5" : "#ffffff";
  const color = primary ? "#ffffff" : NAVY;
  const border = primary ? "#2E78F5" : "#d5deea";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0;"><tr><td style="border-radius:8px;background:${bg};border:1px solid ${border};">
    <a href="${esc(href)}" style="display:inline-block;padding:12px 22px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:${color};text-decoration:none;">${esc(label)}</a>
  </td></tr></table>`;
}

function sessionCard(s: EventMergeData["sessions"][number]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;">
    <tr><td style="border-left:4px solid ${s.accent};background:#f6f8fc;border-radius:6px;padding:12px 14px;font-family:Arial,sans-serif;">
      <div style="font-size:11px;font-weight:bold;letter-spacing:.04em;text-transform:uppercase;color:${s.accent};">${esc(s.type.replace(/_/g, " "))}</div>
      <div style="font-size:15px;font-weight:bold;color:${NAVY};margin-top:2px;">${esc(s.title)}</div>
      ${s.abstract ? `<div style="font-size:13px;color:#4a5568;line-height:1.5;margin-top:4px;">${esc(s.abstract)}</div>` : ""}
    </td></tr></table>`;
}

export function renderEventEmail(merge: EventMergeData, options: RenderOptions): string {
  const dayOf = options.type === "day_of";
  const booklet = options.type === "booklet";
  const lobbyPrimary = dayOf || Boolean(options.includeLobby);
  const showBanner = options.includeBanner !== false && Boolean(merge.bannerUrl);
  const logo = options.logoUrl || "https://icapos.com/logo-email.png";
  const bookletUrl = options.bookletUrl || merge.registerUrl;

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
    ? `<td background="${esc(merge.bannerUrl as string)}" bgcolor="${NAVY}" valign="top" style="background-image:linear-gradient(135deg,rgba(12,35,64,.86),rgba(12,35,64,.7)),url('${esc(merge.bannerUrl as string)}');background-size:cover;background-position:center;">${heroInner}</td>`
    : `<td bgcolor="${NAVY}" valign="top" style="background:${NAVY};">${heroInner}</td>`;

  const registerBtn = booklet
    ? ctaButton(bookletUrl, "Download the booklet (PDF) ↓", true)
    : ctaButton(merge.registerUrl, options.type === "reminder" ? "Register now →" : "Register to attend →", !lobbyPrimary);
  const lobbyBtn = booklet
    ? ctaButton(merge.registerUrl, "Register to attend →", false)
    : (lobbyPrimary || options.includeLobby)
      ? ctaButton(merge.lobbyUrl, "Enter lobby ↗", lobbyPrimary)
      : "";

  const sessionsBlock = merge.sessions.length
    ? `<div style="font-family:Arial,sans-serif;font-size:13px;font-weight:bold;letter-spacing:.05em;text-transform:uppercase;color:#6a7690;margin:6px 0 10px;">Agenda</div>${merge.sessions.map(sessionCard).join("")}`
    : "";

  const sponsorRow = merge.sponsorLockup
    ? `<div style="font-family:Arial,sans-serif;font-size:12px;color:#6a7690;margin:14px 0 0;">${esc(merge.sponsorLockup)}</div>`
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
