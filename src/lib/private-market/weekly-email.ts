/**
 * The Private Market weekly emails: settings, merge fields and the HTML.
 * Pure, so the admin preview, the test send and the weekly send render the
 * same email from the same inputs. Real figures only: the caller passes the
 * market numbers and the recipient's own rating or matches.
 */
import { ordinal, BAND_LABEL, type DigestMarket, type DigestViewer, type FounderRating } from "./weekly-digest";

export type Audience = "founder" | "investor";
export const AUDIENCES: Audience[] = ["founder", "investor"];

export type SectionKey = "rating" | "matches" | "approved" | "moves" | "market" | "gainers" | "sectors" | "listedNote";

export const SECTION_OPTIONS: Record<Audience, Array<{ key: SectionKey; label: string }>> = {
  founder: [
    { key: "rating", label: "Your rating" },
    { key: "market", label: "The market this week" },
    { key: "gainers", label: "Top gainers" },
    { key: "sectors", label: "Sector board" },
    { key: "listedNote", label: "Who is listed note" },
  ],
  investor: [
    { key: "matches", label: "Your top matches" },
    { key: "approved", label: "Newly approved, last 7 days" },
    { key: "moves", label: "Rating moves, last 7 days" },
    { key: "market", label: "The market this week" },
    { key: "gainers", label: "Top gainers" },
    { key: "sectors", label: "Sector board" },
    { key: "listedNote", label: "Who is listed note" },
  ],
};

export type WeeklyEmailConfig = {
  audience: Audience;
  subject: string;
  preheader: string;
  note: string;
  buttonText: string;
  sections: Record<string, boolean>;
  /** Platform groups: "founder" (all founders with a workspace) and "investor" (all approved investors). */
  groups: Audience[];
  listIds: string[];
  skipIfUnchanged: boolean;
  fromName: string | null;
  fromEmail: string | null;
};

export const DEFAULT_SUBJECT: Record<Audience, string> = {
  founder: "Your rating is {rating} ({band}). The Private Market this week",
  investor: "{approved} companies approved this week. Your top matches inside",
};

export function defaultConfig(audience: Audience): WeeklyEmailConfig {
  return {
    audience,
    subject: DEFAULT_SUBJECT[audience],
    preheader: "",
    note: "",
    buttonText: "Open the Private Market board",
    sections: Object.fromEntries(SECTION_OPTIONS[audience].map((s) => [s.key, true])),
    groups: [audience],
    listIds: [],
    skipIfUnchanged: false,
    fromName: null,
    fromEmail: null,
  };
}

export const NOTE_QUICK_INSERTS: Array<{ label: string; text: string }> = [
  { label: "New feature", text: "New this week: the Private Market board now lists every sector of the approved companies. Click a sector to filter the table." },
  { label: "Event reminder", text: "Reminder: our next investor event is coming up. Open the Events page in your workspace to register." },
];

export const MERGE_FIELDS = ["{rating}", "{band}", "{approved}"] as const;

export type MergeValues = { rating: number | null; band: string | null; approved: number };

/** Fills {rating}, {band} and {approved}. A founder with no rating gets "Get your rating" instead of an empty score. */
export function fillMerge(text: string, v: MergeValues): string {
  let out = text;
  if (v.rating === null) {
    out = out.replace(/your rating is\s*\{rating\}\s*(\(\s*\{band\}\s*\))?\.?/i, "Get your rating.");
    out = out.replace(/\{rating\}/g, "").replace(/\{band\}/g, "");
  } else {
    out = out.replace(/\{rating\}/g, String(v.rating)).replace(/\{band\}/g, v.band ?? "");
  }
  return out.replace(/\{approved\}/g, String(v.approved)).replace(/\s{2,}/g, " ").replace(/\(\s*\)/g, "").trim();
}

export function testSubject(subject: string): string {
  return /^\[TEST\]/i.test(subject) ? subject : `[TEST] ${subject}`;
}

export type EmailLinks = {
  appUrl: string;
  logoUrl: string;
  unsubscribeUrl: string;
  preferencesUrl: string;
};

export type RenderInput = {
  config: WeeklyEmailConfig;
  market: DigestMarket;
  viewer: DigestViewer;
  links: EmailLinks;
  /** Adds the TEST SEND strip and the [TEST] subject prefix. */
  test?: boolean;
};

export type RenderedEmail = { subject: string; preheader: string; html: string; text: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const NAVY = "#0f1b3d", BLUE = "#1d4ed8", GREEN = "#0e9f6e", RED = "#d63a56", MUT = "#4a5878", LINE = "#e2e8f2";
const FONT = "Inter,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,Menlo,Consolas,monospace";

const signed = (n: number, digits = 0) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${digits ? Math.abs(n).toFixed(digits) : Math.round(Math.abs(n))}`;
const arrow = (n: number) => (n > 0 ? "▲" : n < 0 ? "▼" : "▬");
const tone = (n: number) => (n > 0 ? GREEN : n < 0 ? RED : MUT);

function section(title: string, body: string): string {
  return `<tr><td style="padding:22px 28px;border-bottom:1px solid ${LINE};"><div style="font:700 11px ${MONO};letter-spacing:.14em;color:${MUT};margin:0 0 12px;">${esc(title)}</div>${body}</td></tr>`;
}

function button(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:${BLUE};color:#ffffff;text-decoration:none;font:600 14px ${FONT};padding:12px 18px;border-radius:10px;">${esc(label)}</a>`;
}

function dataTable(head: string[], rows: string[][]): string {
  const th = head.map((h, i) => `<th align="${i === 0 ? "left" : "right"}" style="font:600 10px ${MONO};color:${MUT};letter-spacing:.06em;padding:0 0 6px;">${esc(h)}</th>`).join("");
  const tr = rows.map((r) => `<tr>${r.map((c, i) => `<td align="${i === 0 ? "left" : "right"}" style="padding:7px 0;border-top:1px solid ${LINE};font:${i === 0 ? 700 : 400} 14px ${FONT};">${c}</td>`).join("")}</tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>${th}</tr>${tr}</table>`;
}

function ratingBlock(r: FounderRating, links: EmailLinks): string {
  const color = r.band === "strong" ? GREEN : r.band === "moderate" ? "#b7791f" : RED;
  const pill = r.band === "strong" ? "#dcfce7;color:#166534" : r.band === "moderate" ? "#fef3c7;color:#92400e" : "#fee2e2;color:#991b1b";
  const week = r.weekChange === null ? "First week with a rating on the board" : r.weekChange === 0 ? `<b>Unchanged this week</b> (${r.weekAgo} last week)` : `<b>${signed(r.weekChange)} this week</b> (${r.weekAgo} last week)`;
  const since = r.sinceFirst === null || r.firstScore === null ? "" : `<br><b>${signed(r.sinceFirst)} since your first reading</b> (${r.firstScore})`;
  const pct = Math.max(0, Math.min(100, r.score));
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="font:700 64px/1 ${FONT};color:${color};padding-right:20px;">${r.score}</td>
<td style="font:400 13px/1.7 ${FONT};color:${MUT};"><span style="display:inline-block;font:700 11px ${MONO};letter-spacing:.08em;padding:3px 9px;border-radius:999px;background:${pill};">${esc(BAND_LABEL[r.band].toUpperCase())} BAND</span><br>${week}${since}<br>Ranked <b>${esc(ordinal(r.rank))} of ${r.of}</b> scored founders</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;"><tr><td width="${pct}%" height="10" style="background:${color};border-radius:99px 0 0 99px;font-size:0;line-height:0;">&nbsp;</td><td height="10" style="background:#e5eaf4;border-radius:0 99px 99px 0;font-size:0;line-height:0;">&nbsp;</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font:600 10px ${MONO};color:${MUT};padding-top:6px;">BUILDING &lt;40</td><td align="center" style="font:600 10px ${MONO};color:${MUT};padding-top:6px;">MODERATE 40 to 69</td><td align="right" style="font:600 10px ${MONO};color:${MUT};padding-top:6px;">STRONG 70+</td></tr></table>
<p style="margin:10px 0 0;font:400 11px ${FONT};color:${MUT};">Your rating is private to you. Other founders see your company on the board only as listed there.</p>
<span style="display:none">${esc(links.appUrl)}</span>`;
}

function notScoredBlock(avg: number | null, links: EmailLinks): string {
  const avgText = avg === null ? "" : `, next to the market average of <b>${avg.toFixed(1)}</b>`;
  return `<p style="margin:0 0 14px;font:400 15px/1.6 ${FONT};">You do not have a rating yet. Finish your readiness assessment and your Capital Readiness Rating will appear here next week${avgText}.</p>${button(`${links.appUrl}/founder/readiness`, "Start your readiness assessment")}`;
}

export function renderWeeklyEmail(input: RenderInput): RenderedEmail {
  const { config, market, viewer, links } = input;
  const a = config.audience;
  const on = (k: SectionKey) => config.sections[k] !== false;
  const rating = viewer.kind === "founder" && !viewer.marketOnly ? viewer.rating ?? null : null;
  const subject0 = fillMerge(config.subject, { rating: rating?.score ?? null, band: rating ? BAND_LABEL[rating.band] : null, approved: market.newlyApproved.count });
  const subject = input.test ? testSubject(subject0) : subject0;
  const preheader = fillMerge(config.preheader, { rating: rating?.score ?? null, band: rating ? BAND_LABEL[rating.band] : null, approved: market.newlyApproved.count });
  const boardUrl = `${links.appUrl}/private-market`;

  const rows: string[] = [];
  const text: string[] = [subject, market.range, ""];

  if (config.note.trim()) {
    rows.push(`<tr><td style="padding:16px 28px;background:#eef3ff;border-bottom:1px solid ${LINE};"><div style="font:700 11px ${MONO};letter-spacing:.14em;color:${BLUE};margin:0 0 6px;">NOTE FROM ICAPOS</div><div style="font:400 14px/1.6 ${FONT};color:${NAVY};">${esc(config.note.trim())}</div></td></tr>`);
    text.push(config.note.trim(), "");
  }

  if (a === "founder" && on("rating") && viewer.kind === "founder" && !viewer.marketOnly) {
    if (rating) {
      rows.push(section("YOUR RATING", ratingBlock(rating, links)));
      text.push(`YOUR RATING: ${rating.score} (${BAND_LABEL[rating.band]}), ranked ${ordinal(rating.rank)} of ${rating.of} scored founders`, "");
    } else {
      rows.push(section("YOUR RATING", notScoredBlock(market.avgCrr, links)));
      text.push("You do not have a rating yet. Start your readiness assessment in your workspace.", "");
    }
  }

  if (a === "investor" && on("matches") && viewer.kind === "investor" && !viewer.marketOnly) {
    if (viewer.matches.length > 0) {
      rows.push(section("YOUR TOP MATCHES", dataTable(["SYMBOL", "YOUR MATCH", "CRR"], viewer.matches.map((m) => [`${esc(m.symbol)} <span style="font-weight:400;color:${MUT};">${esc(m.name)}</span>`, `${m.match}%`, m.crr === null ? "n/a" : String(m.crr)]))));
      text.push("YOUR TOP MATCHES", ...viewer.matches.map((m) => `${m.symbol} ${m.match}% match`), "");
    } else if (!viewer.hasProfile) {
      rows.push(section("YOUR TOP MATCHES", `<p style="margin:0 0 14px;font:400 15px/1.6 ${FONT};">Complete your investor profile and your top matches among the approved companies will appear here.</p>${button(`${links.appUrl}/investor/profile`, "Complete your profile")}`));
    }
  }

  if (a === "investor" && on("approved")) {
    const n = market.newlyApproved;
    rows.push(section("NEWLY APPROVED · LAST 7 DAYS", `<p style="margin:0;font:400 15px/1.6 ${FONT};"><b>${n.count}</b> ${n.count === 1 ? "company was" : "companies were"} approved in the last 7 days, <b>${n.scored}</b> already ${n.scored === 1 ? "has a rating" : "have ratings"}. ${market.approvedTotal} approved in total.</p>`));
    text.push(`NEWLY APPROVED: ${n.count} in 7 days, ${n.scored} scored`, "");
  }

  if (a === "investor" && on("moves") && market.moves.length > 0) {
    rows.push(section("RATING MOVES · LAST 7 DAYS", dataTable(["SYMBOL", "WAS", "NOW"], market.moves.slice(0, 5).map((m) => [esc(m.symbol), m.from === null ? "new" : String(m.from), String(m.to)]))));
    text.push("RATING MOVES", ...market.moves.slice(0, 5).map((m) => `${m.symbol} ${m.from ?? "new"} to ${m.to}`), "");
  }

  if (on("market")) {
    const cell = (t: DigestMarket["tiles"][number]) => `<td width="50%" valign="top" style="padding:0 5px 10px;"><div style="border:1px solid ${LINE};border-radius:10px;padding:10px;"><div style="font:600 10px ${MONO};color:${MUT};letter-spacing:.06em;">${esc(t.label)}</div><div style="font:700 24px ${FONT};color:${NAVY};">${esc(t.value)}</div><div style="font:400 12px ${FONT};color:${t.change === null ? MUT : tone(t.change)};">${esc(t.delta ?? "no change data")}</div></div></td>`;
    const t = market.tiles;
    const grid = [t.slice(0, 2), t.slice(2, 4)].filter((r) => r.length).map((r) => `<tr>${r.map(cell).join("")}</tr>`).join("");
    rows.push(section("THE MARKET THIS WEEK", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 -5px;width:calc(100% + 10px);">${grid}</table>`));
    text.push("THE MARKET THIS WEEK", ...t.map((x) => `${x.label}: ${x.value}${x.delta ? ` (${x.delta})` : ""}`), "");
  }

  if (on("listedNote") && ((on("gainers") && market.gainers.length > 0) || (on("sectors") && market.sectors.length > 0))) {
    const body = a === "founder"
      ? "Only companies with a qualifying Capital Readiness Rating are ranked below. Finish your readiness assessment to be listed."
      : "Only companies with a qualifying Capital Readiness Rating are ranked or matched in this email.";
    rows.push(`<tr><td style="padding:16px 28px;border-bottom:1px solid ${LINE};"><div style="border:1px solid #cdd9f5;border-left:4px solid ${BLUE};background:#eef3ff;border-radius:8px;padding:12px 14px;font:400 12.5px/1.6 ${FONT};color:${NAVY};"><div style="font:700 10.5px ${MONO};letter-spacing:.12em;color:${BLUE};margin-bottom:3px;">WHO IS LISTED</div>${esc(body)}</div></td></tr>`);
    text.push(`WHO IS LISTED: ${body}`, "");
  }

  if (on("gainers") && market.gainers.length > 0) {
    rows.push(section("TOP GAINERS SINCE FIRST READING", dataTable(["SYMBOL", "CRR", "CHG", "%CHG"], market.gainers.map((g) => [esc(g.symbol), String(g.crr), `<span style="color:${tone(g.change)};">${arrow(g.change)} ${signed(g.change)}</span>`, g.pct === null ? "n/a" : `<span style="color:${tone(g.change)};">${signed(g.pct, 1)}%</span>`]))));
    text.push("TOP GAINERS", ...market.gainers.map((g) => `${g.symbol} ${g.crr} (${signed(g.change)})`), "");
  }

  if (on("sectors") && market.sectors.length > 0) {
    rows.push(section("SECTOR BOARD · TOP 5 BY AVERAGE CRR", dataTable(["SECTOR", "CRR", "COMPANIES SCORED"], market.sectors.map((s) => [esc(s.sector), s.avg.toFixed(1), String(s.scored)]))));
    text.push("SECTOR BOARD", ...market.sectors.map((s) => `${s.sector} ${s.avg.toFixed(1)}`), "");
  }

  rows.push(`<tr><td align="center" style="padding:22px 28px;border-bottom:1px solid ${LINE};">${button(boardUrl, config.buttonText || "Open the Private Market board")}<div style="font:400 11px ${FONT};color:${MUT};margin-top:10px;">See all ${market.approvedTotal} approved companies, filter by sector and open any one pager.</div></td></tr>`);
  text.push(`${config.buttonText}: ${boardUrl}`, "");

  const why =
    viewer.marketOnly ? "You receive this because you are on an iCapOS mailing list." :
    a === "founder" ? "You receive this because you have an iCapOS founder workspace." : "You receive this because you are an approved iCapOS investor.";
  const disclaimer = a === "investor" ? " Ratings are readiness indicators, not investment advice." : "";
  const footer = `${why} Figures are live platform data for the 7 days to ${esc(market.asOfLabel)}. ${on("listedNote") ? " Only companies with a qualifying CRR are ranked." : ""} Outreach counts messages sent, never investor names.${disclaimer}<br><a href="${esc(links.unsubscribeUrl)}" style="color:${BLUE};">Unsubscribe</a> · <a href="${esc(links.preferencesUrl)}" style="color:${BLUE};">Email preferences</a> · iCFO Capital Global, Inc., La Jolla, CA`;
  text.push(`${why.replace(/&amp;/g, "&")} To unsubscribe: ${links.unsubscribeUrl}`);

  const headKicker = a === "founder" ? "THE PRIVATE MARKET · WEEKLY" : "THE PRIVATE MARKET · WEEKLY FOR INVESTORS";
  const headTitle = a === "founder" && !viewer.marketOnly ? "Your rating this week" : "What moved this week";
  const testStrip = input.test ? `<tr><td style="background:#fff4c2;color:#6b4e00;font:700 11px ${MONO};letter-spacing:.12em;text-align:center;padding:8px;">TEST SEND · NOT PART OF THE WEEKLY SEND</td></tr>` : "";

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#e9eef7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9eef7;"><tr><td align="center" style="padding:18px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid ${LINE};border-radius:14px;overflow:hidden;font-family:${FONT};color:${NAVY};">
${testStrip}
<tr><td style="padding:18px 28px;border-bottom:1px solid ${LINE};"><img src="${esc(links.logoUrl)}" alt="iCapOS" height="48" style="display:block;height:48px;width:auto;border:0;"></td></tr>
<tr><td style="background:${NAVY};color:#ffffff;padding:22px 28px;"><div style="font:600 11px ${MONO};letter-spacing:.14em;color:#9fb4ff;">${esc(headKicker)}</div><div style="font:700 26px ${FONT};margin:6px 0 2px;">${esc(headTitle)}</div><div style="font:400 13px ${FONT};color:#c8d2ee;">${esc(market.range)}</div></td></tr>
${rows.join("\n")}
<tr><td style="padding:18px 28px;font:400 11px/1.7 ${FONT};color:${MUT};background:#f7f9fd;">${footer}</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, preheader, html, text: text.join("\n") };
}
