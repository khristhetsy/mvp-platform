// Block model for the visual template editor.
//
// The editor manipulates these blocks; `renderBlocksToEmailHtml` regenerates the
// email HTML from them. Output is deliberately old-school email HTML —
// table-based layout with inline styles — because Outlook/Gmail ignore most
// modern CSS. Editing visually can therefore never produce markup that breaks in
// a mail client, which is the whole point of a scoped block editor.

export type BlockAlign = "left" | "center" | "right";

export type TemplateBlock =
  | { id: string; type: "heading"; text: string; level: 1 | 2; color?: string; align?: BlockAlign }
  | { id: string; type: "text"; text: string; color?: string; align?: BlockAlign }
  | { id: string; type: "button"; label: string; url: string; bg?: string; color?: string; align?: BlockAlign }
  | { id: string; type: "image"; src: string; alt?: string; width?: number; align?: BlockAlign }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; height?: number };

export const MERGE_FIELDS = [
  "{{first_name}}",
  "{{last_name}}",
  "{{company}}",
  "{{sender_name}}",
  "{{unsubscribe_url}}",
] as const;

export function newBlockId(): string {
  return `b-${Math.random().toString(36).slice(2, 9)}`;
}

/** A sensible starting layout for a brand-new template. */
export function defaultBlocks(): TemplateBlock[] {
  return [
    { id: newBlockId(), type: "heading", text: "Your headline here", level: 1, align: "left" },
    { id: newBlockId(), type: "text", text: "Dear {{first_name}},", align: "left" },
    { id: newBlockId(), type: "text", text: "Write your message here.", align: "left" },
    { id: newBlockId(), type: "button", label: "Open your pipeline", url: "https://icapos.com", align: "left" },
    { id: newBlockId(), type: "divider" },
    { id: newBlockId(), type: "text", text: "{{sender_name}}", align: "left" },
  ];
}

/** Strip tags for a rough text fallback. */
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>(\s*)/gi, "\n")
    // Block-level closers become a blank line so paragraphs stay separate when
    // seeding blocks (a single \n would merge them into one block).
    .replace(/<\/(p|div|h1|h2|h3|tr)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Seed blocks for a template that only has html_body (never converted).
 * Deliberately conservative: one heading (the subject) plus the existing body as
 * paragraphs, so nothing is invented and no content is lost.
 */
export function seedBlocksFromHtml(subject: string, html: string): TemplateBlock[] {
  const paragraphs = stripHtmlToText(html)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 20);

  const blocks: TemplateBlock[] = [];
  if (subject.trim()) {
    blocks.push({ id: newBlockId(), type: "heading", text: subject.trim(), level: 1, align: "left" });
  }
  for (const p of paragraphs.length > 0 ? paragraphs : ["Write your message here."]) {
    blocks.push({ id: newBlockId(), type: "text", text: p, align: "left" });
  }
  return blocks;
}

// ── HTML rendering ───────────────────────────────────────────────────────────

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escape text but keep {{merge_field}} tokens intact, and honour line breaks. */
function escText(value: string): string {
  return esc(value).replace(/\n/g, "<br />");
}

/** Only allow http(s) links — never javascript: or data: URIs from the editor. */
function safeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "#";
  } catch {
    return "#";
  }
}

const FONT = "Helvetica, Arial, sans-serif";

function renderBlock(block: TemplateBlock): string {
  const align = "align" in block && block.align ? block.align : "left";
  switch (block.type) {
    case "heading": {
      const size = block.level === 1 ? 24 : 19;
      const color = block.color ?? "#0c2340";
      return `<tr><td style="padding:8px 24px;font-family:${FONT};font-size:${size}px;line-height:1.3;font-weight:bold;color:${esc(color)};text-align:${align};">${escText(block.text)}</td></tr>`;
    }
    case "text": {
      const color = block.color ?? "#3a4a63";
      return `<tr><td style="padding:8px 24px;font-family:${FONT};font-size:15px;line-height:1.6;color:${esc(color)};text-align:${align};">${escText(block.text)}</td></tr>`;
    }
    case "button": {
      const bg = block.bg ?? "#2E78F5";
      const color = block.color ?? "#ffffff";
      return `<tr><td style="padding:14px 24px;text-align:${align};"><a href="${esc(safeUrl(block.url))}" style="display:inline-block;background:${esc(bg)};color:${esc(color)};font-family:${FONT};font-size:15px;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:8px;">${escText(block.label)}</a></td></tr>`;
    }
    case "image": {
      // An empty or non-http(s) src would render as a broken image in every
      // recipient's inbox, so drop the row entirely instead of emitting it.
      const src = safeUrl(block.src);
      if (!block.src || src === "#") return "";
      const width = block.width && block.width > 0 ? Math.min(block.width, 600) : 200;
      return `<tr><td style="padding:14px 24px;text-align:${align};"><img src="${esc(src)}" alt="${esc(block.alt ?? "")}" width="${width}" style="display:inline-block;max-width:100%;height:auto;border:0;" /></td></tr>`;
    }
    case "divider":
      return `<tr><td style="padding:10px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #e3e8f2;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>`;
    case "spacer": {
      const h = block.height && block.height > 0 ? Math.min(block.height, 120) : 20;
      return `<tr><td style="height:${h}px;font-size:0;line-height:0;">&nbsp;</td></tr>`;
    }
    default:
      return "";
  }
}

/** Render blocks to email-safe HTML (table layout + inline styles). */
export function renderBlocksToEmailHtml(blocks: TemplateBlock[]): string {
  const rows = blocks.map(renderBlock).join("");
  return [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f8fc;padding:24px 0;">`,
    `<tr><td align="center">`,
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:10px;">`,
    rows,
    `</table>`,
    `</td></tr>`,
    `</table>`,
  ].join("");
}

/** Plain-text alternative generated from the same blocks. */
export function renderBlocksToText(blocks: TemplateBlock[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.type === "heading" || b.type === "text") lines.push(b.text);
    else if (b.type === "button") lines.push(`${b.label}: ${safeUrl(b.url)}`);
    else if (b.type === "divider") lines.push("---");
  }
  return lines.join("\n\n").trim();
}
