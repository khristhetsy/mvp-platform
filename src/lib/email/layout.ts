/**
 * The one layout for every platform email (admin, founder, investor, shared).
 *
 * renderEmail() takes a plain description of the message and returns the
 * subject, the HTML and the plain-text part, built from the same input so the
 * two never drift. Every string is HTML-escaped here; callers pass raw values.
 * The markup is table based with inline styles so it holds up in Gmail,
 * Outlook and Apple Mail.
 *
 * fromFor() gives each audience one sender name over the verified address
 * (see resolveFrom in send-email.ts).
 */

import { EMAIL_BRAND } from "./brand";
import { resolveFrom, TRANSACTIONAL_FROM_ENV } from "./send-email";

export type EmailAudience = "admin" | "founder" | "investor" | "shared";

export type EmailLink = { label: string; url: string };

export type EmailBlock =
  | { type: "paragraph"; text: string }
  | { type: "facts"; rows: Array<{ label: string; value: string }> }
  | {
      type: "rows";
      title?: string;
      items: Array<{ title: string; subtitle?: string | null; right?: string | null; url?: string | null; bar?: number | null }>;
    }
  | { type: "checklist"; title?: string; items: Array<{ label: string; done: boolean; note?: string | null }> }
  | { type: "progress"; label: string; value: string; percent: number }
  /** Rate, Ready, Match, Raise with `step` (0 based) highlighted. */
  | { type: "journey"; step: number }
  | { type: "stats"; items: Array<{ value: string; label: string }> }
  | { type: "note"; text: string; tone?: "info" | "warning" }
  | { type: "quote"; label: string; meta?: string | null; text: string }
  | { type: "action"; title: string; subtitle?: string | null; button: EmailLink }
  | {
      type: "card";
      name: string;
      tagline?: string | null;
      meta?: Array<{ label: string; value: string }>;
    };

export type EmailSpec = {
  audience: EmailAudience;
  subject: string;
  /** Inbox preview line. Shown by Gmail and Apple Mail after the subject. */
  preheader: string;
  /** Top right of the header: a date, a company, a room name. */
  context?: string | null;
  eyebrow?: string | null;
  headline?: string | null;
  /** Opening paragraph under the headline. */
  intro?: string | null;
  blocks?: EmailBlock[];
  primary?: EmailLink | null;
  secondary?: EmailLink | null;
  footer: {
    /** Why this person got the email. Required: every email says it. */
    reason: string;
    /** Absolute link to the notification settings for this recipient. */
    preferencesUrl?: string | null;
    preferencesLabel?: string;
    /** Extra fixed lines (compliance, confidentiality). Plain text. */
    lines?: string[];
  };
};

export type RenderedEmail = { subject: string; html: string; text: string };

// ── Tokens ────────────────────────────────────────────────────────────────

export const AUDIENCE_COLOR: Record<EmailAudience, string> = {
  admin: "#0A1A40",
  founder: "#1A6CE4",
  investor: "#0E7C66",
  shared: "#1A6CE4",
};

const NAVY = "#0A1A40";
const TEXT = EMAIL_BRAND.textColor;
const MUTED = EMAIL_BRAND.mutedColor;
const LINE = "#EEF1F6";
const BORDER = "#E1E6F0";
const PAGE = "#EEF1F7";
const SOFT = "#F4F6FB";
const GREEN = "#2F6B12";
const FONT = EMAIL_BRAND.fontStack;
const JOURNEY = ["Rate", "Ready", "Match", "Raise"] as const;

/** The fixed line founder and investor emails carry. */
export const NOT_A_BROKER_DEALER =
  "iCapOS is not a broker-dealer and does not raise capital or guarantee funding.";

// ── Senders ───────────────────────────────────────────────────────────────

const SENDER_NAME: Record<EmailAudience, string> = {
  admin: "iCapOS Ops",
  founder: "iCapOS",
  investor: "iCFO Capital Global",
  shared: "iCapOS",
};

/**
 * From header for an audience. `name` overrides the default sender name
 * (a staff member, or "iCFO Venture Group" for diligence and e-signature).
 */
export function fromFor(audience: EmailAudience, name?: string | null): string {
  return resolveFrom({ displayName: name?.trim() || SENDER_NAME[audience], envKeys: TRANSACTIONAL_FROM_ENV });
}

// ── Helpers ───────────────────────────────────────────────────────────────

export function esc(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only http(s) and mailto links survive; anything else becomes "#". */
export function safeUrl(url: string | null | undefined): string {
  const u = (url ?? "").trim();
  if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u)) return esc(u);
  if (u.startsWith("/")) return esc(`${EMAIL_BRAND.appUrl}${u}`);
  return "#";
}

function absolute(url: string): string {
  return url.startsWith("/") ? `${EMAIL_BRAND.appUrl}${url}` : url;
}

const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));

function td(style: string, inner: string, attrs = ""): string {
  return `<td${attrs} style="${style}">${inner}</td>`;
}

function table(inner: string, style = ""): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;${style}">${inner}</table>`;
}

function bar(percent: number, color: string, width = "100%"): string {
  const p = clampPct(percent);
  return table(
    `<tr>${p > 0 ? td(`height:6px;background:${color};border-radius:3px;font-size:0;line-height:0;`, "&nbsp;", ` width="${p}%"`) : ""}` +
      (p < 100 ? td(`height:6px;background:#E6EAF2;font-size:0;line-height:0;`, "&nbsp;") : "") +
      `</tr>`,
    `width:${width};border-radius:3px;overflow:hidden;`,
  );
}

function button(link: EmailLink, color: string, primary: boolean): string {
  const style = primary
    ? `background:${color};color:#FFFFFF;border:1px solid ${color};`
    : `background:#FFFFFF;color:${NAVY};border:1px solid #C9D6EE;`;
  return `<a href="${safeUrl(link.url)}" style="${style}display:inline-block;padding:13px 22px;border-radius:8px;font-family:${FONT};font-size:15px;font-weight:bold;line-height:18px;text-decoration:none;">${esc(link.label)}</a>`;
}

// ── Blocks: HTML ──────────────────────────────────────────────────────────

function blockHtml(b: EmailBlock, color: string): string {
  const title = (t?: string) =>
    t ? `<div style="font-size:13px;font-weight:bold;color:${NAVY};padding:0 0 6px;">${esc(t)}</div>` : "";

  switch (b.type) {
    case "paragraph":
      return `<p style="margin:0;font-size:15px;line-height:24px;color:${TEXT};">${esc(b.text)}</p>`;

    case "facts":
      return table(
        b.rows
          .map(
            (r) =>
              `<tr>${td(`padding:10px 12px 10px 0;border-top:1px solid ${LINE};font-size:14px;color:${MUTED};vertical-align:top;white-space:nowrap;`, esc(r.label))}` +
              `${td(`padding:10px 0;border-top:1px solid ${LINE};font-size:14px;color:${TEXT};text-align:right;`, esc(r.value))}</tr>`,
          )
          .join(""),
        `border-bottom:1px solid ${LINE};`,
      );

    case "rows":
      return (
        title(b.title) +
        table(
          b.items
            .map((it) => {
              const left =
                `<div style="font-size:14px;font-weight:bold;color:${TEXT};">${esc(it.title)}</div>` +
                (it.subtitle ? `<div style="font-size:12px;color:${MUTED};padding-top:2px;">${esc(it.subtitle)}</div>` : "");
              const barCell = it.bar != null ? td(`padding:10px 12px;border-top:1px solid ${LINE};width:120px;vertical-align:middle;`, bar(it.bar, color)) : "";
              const right = it.right
                ? td(`padding:10px 0 10px 8px;border-top:1px solid ${LINE};font-size:13px;font-weight:bold;color:${NAVY};text-align:right;white-space:nowrap;`, esc(it.right))
                : "";
              const link = it.url
                ? td(`padding:10px 0 10px 12px;border-top:1px solid ${LINE};font-size:13px;text-align:right;white-space:nowrap;`, `<a href="${safeUrl(it.url)}" style="color:${color};">Open</a>`)
                : "";
              return `<tr>${td(`padding:10px 0;border-top:1px solid ${LINE};vertical-align:middle;`, left)}${barCell}${right}${link}</tr>`;
            })
            .join(""),
        )
      );

    case "checklist":
      return (
        title(b.title) +
        table(
          b.items
            .map((it, i) => {
              const mark = it.done
                ? `<span style="color:${GREEN};font-weight:bold;">&#10003;</span>`
                : `<span style="color:${color};">&#9675;</span>`;
              const border = i === 0 ? "" : `border-top:1px solid ${LINE};`;
              return (
                `<tr>${td(`padding:12px 0 12px 16px;${border}width:22px;font-size:15px;`, mark)}` +
                td(
                  `padding:12px 16px 12px 8px;${border}font-size:14px;color:${it.done ? MUTED : TEXT};${it.done ? "" : "font-weight:bold;"}`,
                  esc(it.label) + (it.note ? ` <span style="font-weight:normal;color:${MUTED};">· ${esc(it.note)}</span>` : ""),
                ) +
                `</tr>`
              );
            })
            .join(""),
          `border:1px solid ${BORDER};border-radius:10px;border-collapse:separate;`,
        )
      );

    case "progress":
      return (
        table(
          `<tr>${td(`font-size:13px;color:${MUTED};padding:0 0 8px;`, esc(b.label))}${td(`font-size:13px;font-weight:bold;color:${TEXT};text-align:right;padding:0 0 8px;`, esc(b.value))}</tr>`,
        ) + bar(b.percent, color)
      );

    case "journey": {
      const step = Math.max(0, Math.min(JOURNEY.length - 1, Math.floor(b.step)));
      const cells = JOURNEY.map((name, i) => {
        const c = i < step ? GREEN : i === step ? AUDIENCE_COLOR.founder : "#D3D8E3";
        return td(
          `width:25%;padding:0 2px;vertical-align:top;`,
          `<div style="height:6px;background:${c};border-radius:3px;font-size:0;line-height:0;">&nbsp;</div>` +
            `<div style="font-size:12px;padding-top:5px;color:${i === step ? AUDIENCE_COLOR.founder : MUTED};${i === step ? "font-weight:bold;" : ""}">${name}</div>`,
        );
      }).join("");
      return table(`<tr>${cells}</tr>`, "table-layout:fixed;");
    }

    case "stats": {
      const w = Math.floor(100 / Math.max(1, b.items.length));
      return table(
        `<tr>${b.items
          .map((s, i) =>
            td(
              `width:${w}%;padding:0 ${i === b.items.length - 1 ? 0 : 5}px 0 ${i === 0 ? 0 : 5}px;vertical-align:top;`,
              `<div style="background:${SOFT};border-radius:8px;padding:12px 14px;">` +
                `<div style="font-size:22px;font-weight:bold;color:${NAVY};line-height:28px;">${esc(s.value)}</div>` +
                `<div style="font-size:12px;color:${MUTED};">${esc(s.label)}</div></div>`,
            ),
          )
          .join("")}</tr>`,
        "table-layout:fixed;",
      );
    }

    case "note":
      return b.tone === "warning"
        ? `<div style="background:#FDF3E4;border:1px solid #F1D6A8;color:#6B3D00;border-radius:8px;padding:12px 14px;font-size:14px;line-height:21px;">${esc(b.text)}</div>`
        : `<div style="background:${SOFT};border-radius:10px;padding:14px 16px;font-size:14px;line-height:21px;color:${TEXT};">${esc(b.text)}</div>`;

    case "quote":
      return (
        `<div style="background:${SOFT};border-radius:10px;padding:16px 18px;">` +
        table(
          `<tr>${td(`font-size:12px;font-weight:bold;color:${NAVY};padding:0 0 8px;`, esc(b.label))}${td(`font-size:12px;color:${MUTED};text-align:right;padding:0 0 8px;`, esc(b.meta ?? ""))}</tr>`,
        ) +
        `<div style="font-size:15px;line-height:23px;color:${TEXT};white-space:pre-line;">${esc(b.text)}</div></div>`
      );

    case "action":
      return table(
        `<tr>${td(
          `padding:14px 16px;vertical-align:middle;`,
          `<div style="font-size:15px;font-weight:bold;color:${TEXT};">${esc(b.title)}</div>` +
            (b.subtitle ? `<div style="font-size:13px;color:#3A4A6B;padding-top:3px;">${esc(b.subtitle)}</div>` : ""),
        )}${td(
          `padding:14px 16px;text-align:right;vertical-align:middle;white-space:nowrap;`,
          `<a href="${safeUrl(b.button.url)}" style="background:${color};color:#FFFFFF;display:inline-block;padding:12px 16px;border-radius:8px;font-size:14px;font-weight:bold;text-decoration:none;">${esc(b.button.label)}</a>`,
        )}</tr>`,
        `background:#F2F7FF;border:1px solid #BFD4F6;border-radius:10px;border-collapse:separate;`,
      );

    case "card": {
      const initial = esc(b.name.trim().charAt(0).toUpperCase() || "?");
      const meta = b.meta?.length
        ? `<tr><td colspan="2" style="padding:0;border-top:1px solid ${LINE};background:#F7F9FC;">${table(
            `<tr>${b.meta
              .map((m, i) =>
                td(
                  `padding:12px 14px;${i ? `border-left:1px solid ${LINE};` : ""}vertical-align:top;`,
                  `<div style="font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:0.06em;">${esc(m.label)}</div>` +
                    `<div style="font-size:14px;font-weight:bold;color:${TEXT};padding-top:2px;">${esc(m.value)}</div>`,
                ),
              )
              .join("")}</tr>`,
            "table-layout:fixed;",
          )}</td></tr>`
        : "";
      return table(
        `<tr>${td(
          `padding:18px 0 18px 18px;width:48px;vertical-align:middle;`,
          `<div style="width:48px;height:48px;line-height:48px;border-radius:10px;background:${NAVY};color:#FFFFFF;font-size:22px;font-weight:bold;text-align:center;">${initial}</div>`,
        )}${td(
          `padding:18px;vertical-align:middle;`,
          `<div style="font-size:18px;font-weight:bold;color:${NAVY};">${esc(b.name)}</div>` +
            (b.tagline ? `<div style="font-size:14px;color:#3A4A6B;padding-top:3px;">${esc(b.tagline)}</div>` : ""),
        )}</tr>${meta}`,
        `border:1px solid ${BORDER};border-radius:12px;border-collapse:separate;overflow:hidden;`,
      );
    }
  }
}

// ── Blocks: plain text ────────────────────────────────────────────────────

function blockText(b: EmailBlock): string {
  switch (b.type) {
    case "paragraph":
      return b.text;
    case "facts":
      return b.rows.map((r) => `${r.label}: ${r.value}`).join("\n");
    case "rows":
      return [
        b.title ?? null,
        ...b.items.map(
          (it) =>
            `- ${it.title}${it.subtitle ? ` (${it.subtitle})` : ""}${it.right ? `: ${it.right}` : ""}${it.url ? `\n  ${absolute(it.url)}` : ""}`,
        ),
      ]
        .filter((l): l is string => l !== null)
        .join("\n");
    case "checklist":
      return [b.title ?? null, ...b.items.map((it) => `${it.done ? "[x]" : "[ ]"} ${it.label}${it.note ? ` (${it.note})` : ""}`)]
        .filter((l): l is string => l !== null)
        .join("\n");
    case "progress":
      return `${b.label}: ${b.value}`;
    case "journey": {
      const step = Math.max(0, Math.min(JOURNEY.length - 1, Math.floor(b.step)));
      return `Your raise: step ${step + 1} of ${JOURNEY.length} (${JOURNEY[step]})`;
    }
    case "stats":
      return b.items.map((s) => `${s.value} ${s.label}`).join(" · ");
    case "note":
      return b.text;
    case "quote":
      return `${b.label}${b.meta ? ` · ${b.meta}` : ""}:\n"${b.text}"`;
    case "action":
      return `${b.title}${b.subtitle ? ` (${b.subtitle})` : ""}\n${b.button.label}: ${absolute(b.button.url)}`;
    case "card":
      return [b.name, b.tagline ?? null, b.meta?.length ? b.meta.map((m) => `${m.label}: ${m.value}`).join(" · ") : null]
        .filter((l): l is string => l !== null)
        .join("\n");
  }
}

// ── Render ────────────────────────────────────────────────────────────────

export function renderEmail(spec: EmailSpec): RenderedEmail {
  const color = AUDIENCE_COLOR[spec.audience];
  const blocks = spec.blocks ?? [];
  const brand = EMAIL_BRAND;

  const head: string[] = [];
  if (spec.eyebrow)
    head.push(`<div style="font-size:12px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:${color};padding:0 0 8px;">${esc(spec.eyebrow)}</div>`);
  if (spec.headline)
    head.push(`<h1 style="margin:0;padding:0 0 8px;font-family:${FONT};font-size:24px;line-height:30px;font-weight:bold;color:${NAVY};">${esc(spec.headline)}</h1>`);
  if (spec.intro) head.push(`<p style="margin:0;font-size:15px;line-height:24px;color:${TEXT};">${esc(spec.intro)}</p>`);

  const sections = [
    head.length ? head.join("") : null,
    ...blocks.map((b) => blockHtml(b, color)),
    spec.primary || spec.secondary
      ? `<div>${spec.primary ? button(spec.primary, color, true) : ""}${
          spec.secondary
            ? `<a href="${safeUrl(spec.secondary.url)}" style="display:inline-block;padding:13px 0 13px ${spec.primary ? 18 : 0}px;font-size:14px;color:${color};">${esc(spec.secondary.label)}</a>`
            : ""
        }</div>`
      : null,
  ].filter((s): s is string => s !== null);

  const body = sections.map((s, i) => `<tr><td style="padding:${i === 0 ? 0 : 20}px 0 0;">${s}</td></tr>`).join("");

  const footerLines = [
    `${esc(spec.footer.reason)}${
      spec.footer.preferencesUrl
        ? ` <a href="${safeUrl(spec.footer.preferencesUrl)}" style="color:${MUTED};text-decoration:underline;">${esc(spec.footer.preferencesLabel ?? "Email preferences")}</a>`
        : ""
    }`,
    ...(spec.footer.lines ?? []).map(esc),
  ];

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(spec.subject)}</title></head>
<body style="margin:0;padding:0;background:${PAGE};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAGE};opacity:0;">${esc(spec.preheader)}${"&#8199;&#65279;&#847; ".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE};"><tr><td align="center" style="padding:28px 12px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#FFFFFF;border:1px solid ${BORDER};border-radius:12px;border-collapse:separate;font-family:${FONT};">
<tr><td style="padding:18px 28px;">${table(
    `<tr>${td("vertical-align:middle;", `<img src="${esc(brand.logoUrl)}" width="114" height="32" alt="iCapOS" style="display:block;border:0;width:114px;height:32px;">`)}${td(
      `vertical-align:middle;text-align:right;font-family:${FONT};font-size:12px;color:${MUTED};`,
      esc(spec.context ?? ""),
    )}</tr>`,
  )}</td></tr>
<tr><td style="height:3px;background:${color};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:28px;font-family:${FONT};color:${TEXT};">${table(body)}</td></tr>
<tr><td style="border-top:1px solid ${LINE};padding:16px 28px;font-family:${FONT};font-size:12px;line-height:19px;color:${MUTED};">${footerLines.join("<br>")}</td></tr>
</table>
<div style="font-family:${FONT};font-size:12px;color:${MUTED};padding:14px 0 0;">${esc(brand.company.legalName)} · ${esc(brand.company.addressLine)}</div>
</td></tr></table>
</body></html>`;

  const text = [
    spec.headline ?? null,
    spec.intro ?? null,
    ...blocks.map(blockText),
    spec.primary ? `${spec.primary.label}: ${absolute(spec.primary.url)}` : null,
    spec.secondary ? `${spec.secondary.label}: ${absolute(spec.secondary.url)}` : null,
    "--",
    spec.footer.reason + (spec.footer.preferencesUrl ? ` ${spec.footer.preferencesLabel ?? "Email preferences"}: ${absolute(spec.footer.preferencesUrl)}` : ""),
    ...(spec.footer.lines ?? []),
    `${brand.company.legalName} · ${brand.company.addressLine}`,
  ]
    .filter((l): l is string => l !== null && l !== "")
    .join("\n\n");

  return { subject: spec.subject, html, text };
}
