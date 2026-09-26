/**
 * Email copy for account-activity alerts (to staff) and the founder's upload
 * confirmation. Pure: every value arrives already loaded, so these render the
 * same way in tests as in production.
 *
 * Two rules the copy keeps:
 *   - every alert names the company and the person who acted, so two uploads
 *     from two founders never look identical in an inbox;
 *   - every link is absolute. A relative path cannot be opened from Gmail.
 */

export type ChecklistItem = { label: string; done: boolean };

export type DocumentDetail = {
  fileName: string | null;
  sizeBytes: number | null;
};

export type AdminActivityEmailInput = {
  title: string;
  stageLabel: string;
  classDescription: string;
  critical: boolean;
  companyName: string | null;
  actor: { name: string; email: string | null; roleLabel: string } | null;
  document: DocumentDetail | null;
  checklist: ChecklistItem[] | null;
  readinessScore: number | null;
  ownerName: string | null;
  noOwner: boolean;
  primaryUrl: string;
  assignUrl: string;
};

export type FounderUploadEmailInput = {
  firstName: string | null;
  companyName: string | null;
  documentLabel: string;
  fileName: string | null;
  replaced: boolean;
  /** 0 based index into Rate, Ready, Match, Raise. */
  stepIndex: number;
  checklist: ChecklistItem[];
  next: { label: string; cta: string; url: string } | null;
  workspaceUrl: string;
};

export type RenderedEmail = { subject: string; text: string; html: string };

export const FOUNDER_STEPS = ["Rate", "Ready", "Match", "Raise"] as const;

const NAVY = "#0A1A40";
const BLUE = "#1A6CE4";
const TEXT = "#16223F";
const MUTED = "#5A6B8C";
const FONT = "Helvetica, Arial, sans-serif";

/** The app's public origin, never empty. An unset env var used to yield "/admin/...". */
export function appOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  return (raw || "https://icapos.com").replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${appOrigin()}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatBytes(bytes: number | null): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "Stage 2 · Preparation" reads badly inside a subject that already uses "·". */
export function subjectStage(stageLabel: string): string {
  return stageLabel.replace(/\s*·\s*/g, " ");
}

/**
 * "Northstar Robotics uploaded pitch deck" when the title opens with a past
 * tense verb the company performed; "Northstar Robotics: Investor requested an
 * introduction" otherwise, so an investor's action is never attributed to the
 * company.
 */
export function companyHeadline(companyName: string | null, title: string): string {
  const clean = title.trim();
  if (!companyName) return clean;
  const [first, ...rest] = clean.split(/\s+/);
  if (first && /^[A-Z][a-z]+ed$/.test(first)) {
    return [companyName, first.toLowerCase(), ...rest].join(" ");
  }
  return `${companyName}: ${clean}`;
}

export function button(label: string, url: string, primary: boolean): string {
  const style = primary
    ? `background:${BLUE};color:#ffffff;border:1px solid ${BLUE};`
    : `background:#ffffff;color:${BLUE};border:1px solid #C9D6EE;`;
  return `<a href="${escapeHtml(url)}" style="${style}display:inline-block;padding:10px 16px;border-radius:8px;font-family:${FONT};font-size:14px;font-weight:bold;text-decoration:none;margin:0 8px 8px 0;">${escapeHtml(label)}</a>`;
}

export function shell(inner: string): string {
  return [
    `<div style="background:#F4F6FB;padding:24px 12px;">`,
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #E3E8F2;border-radius:12px;overflow:hidden;">`,
    `<div style="background:${NAVY};padding:14px 24px;font-family:${FONT};font-size:16px;font-weight:bold;color:#ffffff;">iCap<span style="color:#2E78F5;">OS</span></div>`,
    `<div style="padding:24px;font-family:${FONT};color:${TEXT};font-size:14px;line-height:1.6;">`,
    inner,
    `</div></div>`,
    `<div style="max-width:560px;margin:12px auto 0;font-family:${FONT};font-size:12px;color:${MUTED};text-align:center;">iCFO Capital Global, Inc. · La Jolla, CA 92037</div>`,
    `</div>`,
  ].join("");
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:6px 0;color:${MUTED};font-size:13px;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;text-align:right;font-size:13px;">${escapeHtml(value)}</td></tr>`;
}

function checklistSummary(items: ChecklistItem[]): string {
  const done = items.filter((i) => i.done).map((i) => i.label);
  const pending = items.filter((i) => !i.done).map((i) => i.label);
  const parts: string[] = [];
  if (done.length) parts.push(`Done: ${done.join(", ")}`);
  if (pending.length) parts.push(`Pending: ${pending.join(", ")}`);
  return parts.join(" · ");
}

export function renderAdminActivityEmail(input: AdminActivityEmailInput): RenderedEmail {
  const headline = companyHeadline(input.companyName, input.title);
  const subject = `${input.critical ? "[Action needed] " : ""}${headline} · ${subjectStage(input.stageLabel)}`;

  const facts: Array<[string, string]> = [];
  if (input.document?.fileName) {
    const size = formatBytes(input.document.sizeBytes);
    facts.push(["File", size ? `${input.document.fileName} · ${size}` : input.document.fileName]);
  }
  facts.push(["Stage", input.stageLabel]);
  facts.push(["What this covers", input.classDescription]);
  if (input.checklist?.length) facts.push(["Core documents", checklistSummary(input.checklist)]);
  if (input.readinessScore != null) facts.push(["Readiness rating", `${Math.round(input.readinessScore)} / 100`]);
  facts.push(["Owner", input.noOwner ? "No owner assigned to this stage" : input.ownerName ?? "No lead assigned"]);

  const text = [
    headline,
    "",
    input.actor
      ? `${input.actor.name} (${input.actor.roleLabel}${input.actor.email ? `, ${input.actor.email}` : ""})${input.companyName ? ` at ${input.companyName}` : ""}`
      : null,
    "",
    ...facts.map(([k, v]) => `${k}: ${v}`),
    "",
    `Open: ${input.primaryUrl}`,
    input.noOwner ? `Assign an owner: ${input.assignUrl}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const initials = input.actor
    ? input.actor.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]!.toUpperCase())
        .join("")
    : "";

  const html = shell(
    [
      `<div style="font-size:18px;font-weight:bold;margin:0 0 16px;">${escapeHtml(headline)}</div>`,
      input.actor
        ? `<table role="presentation" style="margin:0 0 16px;border-collapse:collapse;"><tr>` +
          `<td style="width:40px;height:40px;border-radius:20px;background:#E6F1FB;color:#0C447C;text-align:center;font-weight:bold;font-size:14px;">${escapeHtml(initials)}</td>` +
          `<td style="padding-left:12px;"><div style="font-weight:bold;">${escapeHtml(input.actor.name)}, ${escapeHtml(input.actor.roleLabel)}</div>` +
          `<div style="font-size:13px;color:${MUTED};">${escapeHtml([input.actor.email, input.companyName].filter(Boolean).join(" · "))}</div></td>` +
          `</tr></table>`
        : "",
      `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 16px;">${facts.map(([k, v]) => row(k, v)).join("")}</table>`,
      input.noOwner
        ? `<div style="background:#FAEEDA;color:#633806;border-radius:8px;padding:10px 12px;font-size:13px;margin:0 0 16px;">No owner is assigned to this stage yet.</div>`
        : "",
      `<div>${button(input.companyName ? "Open company" : "Open activity", input.primaryUrl, true)}${input.noOwner ? button("Assign owner", input.assignUrl, false) : ""}</div>`,
      `<div style="font-size:12px;color:${MUTED};margin-top:12px;word-break:break-all;">Full link: ${escapeHtml(input.primaryUrl)}</div>`,
    ].join(""),
  );

  return { subject, text, html };
}

export function renderFounderUploadEmail(input: FounderUploadEmailInput): RenderedEmail {
  const noun = input.documentLabel.toLowerCase();
  const subject = input.firstName
    ? `${input.firstName}, we received your ${noun}`
    : `We received your ${noun}`;

  const pending = input.checklist.filter((i) => !i.done);
  const remaining =
    pending.length === 0
      ? "Your core documents are complete."
      : `${pending.length} core document${pending.length === 1 ? "" : "s"} remain${pending.length === 1 ? "s" : ""} before investor matching: ${pending.map((p) => p.label.toLowerCase()).join(", ")}.`;
  const opening = `Your ${noun}${input.companyName ? ` for ${input.companyName}` : ""} is ${input.replaced ? "updated" : "in"}. ${remaining}`;
  const greeting = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const step = Math.min(Math.max(input.stepIndex, 0), FOUNDER_STEPS.length - 1);

  const text = [
    greeting,
    "",
    opening,
    "",
    `Your raise: step ${step + 1} of ${FOUNDER_STEPS.length} (${FOUNDER_STEPS[step]})`,
    ...input.checklist.map((i) => `${i.done ? "[x]" : "[ ]"} ${i.label}`),
    "",
    input.next ? `${input.next.cta}: ${input.next.url}` : null,
    `Open your workspace: ${input.workspaceUrl}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const bars = FOUNDER_STEPS.map((_, i) => {
    const color = i < step ? "#3B6D11" : i === step ? BLUE : "#D3D8E3";
    return `<td style="padding:0 2px;"><div style="height:6px;border-radius:3px;background:${color};"></div></td>`;
  }).join("");
  const labels = FOUNDER_STEPS.map(
    (name, i) =>
      `<td style="padding:4px 2px 0;font-size:12px;color:${i === step ? BLUE : MUTED};">${name}</td>`,
  ).join("");
  const items = input.checklist
    .map((i) =>
      i.done
        ? `<div style="padding:3px 0;"><span style="color:#3B6D11;">&#10003;</span> ${escapeHtml(i.label)}${i.label.toLowerCase() === noun && input.fileName ? ` <span style="color:${MUTED};">· ${escapeHtml(input.fileName)}</span>` : ""}</div>`
        : `<div style="padding:3px 0;color:${MUTED};">&#9675; ${escapeHtml(i.label)}</div>`,
    )
    .join("");

  const html = shell(
    [
      `<div style="font-size:18px;font-weight:bold;margin:0 0 12px;">${escapeHtml(subject)}</div>`,
      `<p style="margin:0 0 16px;">${escapeHtml(greeting)} ${escapeHtml(opening)}</p>`,
      `<div style="font-size:12px;color:${MUTED};margin:0 0 6px;">Your raise: step ${step + 1} of ${FOUNDER_STEPS.length}</div>`,
      `<table role="presentation" style="width:100%;table-layout:fixed;border-collapse:collapse;margin:0 0 16px;"><tr>${bars}</tr><tr>${labels}</tr></table>`,
      input.checklist.length ? `<div style="margin:0 0 16px;font-size:14px;">${items}</div>` : "",
      `<div>${input.next ? button(input.next.cta, input.next.url, true) : ""}${button("Open your workspace", input.workspaceUrl, !input.next)}</div>`,
    ].join(""),
  );

  return { subject, text, html };
}
