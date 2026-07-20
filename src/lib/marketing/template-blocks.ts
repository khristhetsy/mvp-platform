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

// ── HTML → blocks ────────────────────────────────────────────────────────────

const MAX_PARSED_BLOCKS = 80;

/** Read one attribute off a raw tag string. */
function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
  return m ? (m[2] ?? m[3] ?? "").trim() : undefined;
}

/** Read one property out of an inline style attribute. */
function styleProp(tag: string, prop: string): string | undefined {
  const style = attr(tag, "style");
  if (!style) return undefined;
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i").exec(style);
  return m ? m[1].trim() : undefined;
}

function decodeEntities(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** An <a> is a call-to-action button if it's styled like one. */
function looksLikeButton(tag: string): boolean {
  const bg = styleProp(tag, "background") ?? styleProp(tag, "background-color");
  if (bg && !/^(none|transparent|inherit)$/i.test(bg)) return true;
  const display = styleProp(tag, "display");
  const padding = styleProp(tag, "padding");
  return Boolean(display && /inline-block|block/i.test(display) && padding);
}

function alignOf(tag: string): BlockAlign | undefined {
  const raw = styleProp(tag, "text-align") ?? attr(tag, "align");
  if (!raw) return undefined;
  const v = raw.toLowerCase();
  return v === "center" || v === "right" || v === "left" ? v : undefined;
}

/**
 * Parse existing email HTML into editable blocks, preserving structure rather
 * than flattening everything to paragraphs: headings stay headings, images stay
 * images, styled links stay buttons, rules stay dividers.
 *
 * Deliberately a small tag scanner rather than a DOM parse — this runs in Node
 * (tests, server) as well as the browser, so `DOMParser` isn't available.
 */
export function parseHtmlToBlocks(html: string): TemplateBlock[] {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|head)\b[\s\S]*?<\/\1>/gi, "");

  const blocks: TemplateBlock[] = [];
  let buffer = "";
  let bufferAlign: BlockAlign | undefined;

  function flushText() {
    const text = decodeEntities(buffer);
    buffer = "";
    if (text) blocks.push({ id: newBlockId(), type: "text", text, align: bufferAlign ?? "left" });
    bufferAlign = undefined;
  }

  // Capture groups, in order: 1 heading level, 2 heading attrs, 3 heading inner,
  // 4 anchor attrs, 5 anchor inner, 6 block-container attrs, 7 block closer name.
  // The trailing `<[^>]+>` swallows every other tag (inline markup) without
  // flushing, so a </span> mid-sentence doesn't split a paragraph in two.
  const TOKEN =
    /<img\b[^>]*>|<hr\b[^>]*>|<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>|<a\b([^>]*)>([\s\S]*?)<\/a>|<(?:p|div|td|tr|table|li)\b([^>]*)>|<\/(p|div|td|tr|table|li)>|<[^>]+>/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN.exec(cleaned)) !== null) {
    if (blocks.length >= MAX_PARSED_BLOCKS) break;
    buffer += cleaned.slice(lastIndex, match.index);
    lastIndex = TOKEN.lastIndex;
    const raw = match[0];

    if (/^<img/i.test(raw)) {
      flushText();
      const src = attr(raw, "src") ?? "";
      const widthRaw = attr(raw, "width");
      const width = widthRaw && /^\d+$/.test(widthRaw) ? Number(widthRaw) : undefined;
      blocks.push({
        id: newBlockId(),
        type: "image",
        src,
        alt: attr(raw, "alt") ?? "",
        width: width ?? 200,
        align: alignOf(raw) ?? "center",
      });
      continue;
    }

    if (/^<hr/i.test(raw)) {
      flushText();
      blocks.push({ id: newBlockId(), type: "divider" });
      continue;
    }

    if (match[1]) {
      flushText();
      const text = decodeEntities(match[3].replace(/<[^>]+>/g, " "));
      if (text) {
        blocks.push({
          id: newBlockId(),
          type: "heading",
          text,
          level: Number(match[1]) <= 2 ? 1 : 2,
          color: styleProp(match[2], "color"),
          align: alignOf(match[2]) ?? "left",
        });
      }
      continue;
    }

    if (match[4] !== undefined) {
      const linkTag = `<a${match[4]}>`;
      const label = decodeEntities((match[5] ?? "").replace(/<[^>]+>/g, " "));
      if (looksLikeButton(linkTag) && label) {
        flushText();
        blocks.push({
          id: newBlockId(),
          type: "button",
          label,
          url: attr(linkTag, "href") ?? "#",
          bg: styleProp(linkTag, "background") ?? styleProp(linkTag, "background-color"),
          color: styleProp(linkTag, "color"),
          align: alignOf(linkTag) ?? "left",
        });
      } else {
        buffer += ` ${label} `;
      }
      continue;
    }

    if (match[6] !== undefined) {
      // Opening a block-level container: remember its alignment for the text inside.
      bufferAlign = alignOf(match[6]) ?? bufferAlign;
      continue;
    }

    if (match[7] !== undefined) {
      flushText();
      continue;
    }
  }

  buffer += cleaned.slice(lastIndex);
  flushText();

  return blocks.slice(0, MAX_PARSED_BLOCKS);
}

/**
 * Seed blocks for a template that only has html_body (never converted).
 * Parses the existing markup so the visual editor shows the real layout; falls
 * back to subject-plus-paragraphs when the HTML yields nothing usable.
 */
export function seedBlocksFromHtml(subject: string, html: string): TemplateBlock[] {
  const parsed = parseHtmlToBlocks(html);
  const hasContent = parsed.some(
    (b) =>
      (b.type === "text" && b.text.trim()) ||
      (b.type === "heading" && b.text.trim()) ||
      b.type === "image" ||
      b.type === "button",
  );
  if (hasContent) return parsed;

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
