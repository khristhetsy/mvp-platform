// Block model for the visual template editor.
//
// The editor manipulates these blocks; `renderBlocksToEmailHtml` regenerates the
// email HTML from them. Output is deliberately old-school email HTML —
// table-based layout with inline styles — because Outlook/Gmail ignore most
// modern CSS. Editing visually can therefore never produce markup that breaks in
// a mail client, which is the whole point of a scoped block editor.

export type BlockAlign = "left" | "center" | "right";

export type TemplateBlock =
  | { id: string; type: "heading"; text: string; level: 1 | 2; color?: string; align?: BlockAlign; url?: string }
  | { id: string; type: "text"; text: string; color?: string; align?: BlockAlign; url?: string }
  | { id: string; type: "button"; label: string; url: string; bg?: string; color?: string; align?: BlockAlign }
  | { id: string; type: "image"; src: string; alt?: string; width?: number; align?: BlockAlign }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; height?: number }
  // A coloured band. Deliberately self-contained (eyebrow + heading + body)
  // rather than a container of child blocks — nesting would mean a much larger
  // editor and parser, and every banded design we have fits this shape.
  | {
      id: string;
      type: "section";
      eyebrow?: string;
      heading?: string;
      text?: string;
      bg?: string;
      color?: string;
      padV?: number;
      padH?: number;
      align?: BlockAlign;
      fullWidth?: boolean;
    }
  | { id: string; type: "callout"; text: string; bg?: string; borderColor?: string; color?: string }
  | { id: string; type: "list"; items: string[]; ordered?: boolean; color?: string }
  | { id: string; type: "columns"; cells: Array<{ title?: string; text?: string }>; bg?: string }
  | { id: string; type: "stats"; items: Array<{ value: string; label: string }>; color?: string };

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

// Private-use characters bracket each token so it can never collide with real
// copy and survive entity decoding and whitespace collapsing intact. Splitting
// on whitespace alone failed when a token sat flush against adjacent text.
const TOKEN_OPEN = "\uE000";
const TOKEN_CLOSE = "\uE001";
const PLACEHOLDER = new RegExp(`${TOKEN_OPEN}(B\\d+)${TOKEN_CLOSE}`);
const PLACEHOLDER_SPLIT = new RegExp(`(${TOKEN_OPEN}B\\d+${TOKEN_CLOSE})`);

/**
 * Lift lists, coloured bands, and multi-cell rows out of the HTML before the
 * linear scan, since the scanner works tag-by-tag and can't see nesting. Each
 * is swapped for a placeholder token so document order is preserved.
 */
/**
 * Replace tables innermost-first. A plain non-greedy `<table>…</table>` regex
 * mismatches on nested tables — it pairs an outer opener with an inner closer —
 * so match only tables that contain no further table, and repeat until stable.
 */
function replaceInnermost(
  html: string,
  tag: "table" | "tr",
  fn: (whole: string, attrs: string, inner: string) => string,
): string {
  const INNERMOST = new RegExp(`<${tag}\\b([^>]*)>((?:(?!<${tag}\\b)[\\s\\S])*?)</${tag}>`, "gi");
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    const next = html.replace(INNERMOST, (m, attrs: string, inner: string) => {
      const out = fn(m, attrs, inner);
      if (out !== m) changed = true;
      return out;
    });
    html = next;
    if (!changed) break;
  }
  return html;
}

function extractStructures(html: string, out: Map<string, TemplateBlock>): string {
  let n = 0;
  const token = (block: TemplateBlock) => {
    const key = `B${n++}`;
    out.set(key, block);
    return `${TOKEN_OPEN}${key}${TOKEN_CLOSE}`;
  };

  // Lists → list blocks.
  html = html.replace(/<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, tag: string, inner: string) => {
    const items = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, " ")))
      .filter(Boolean);
    if (items.length === 0) return "";
    return token({ id: newBlockId(), type: "list", items, ordered: tag.toLowerCase() === "ol" });
  });

  // Stats and columns are multi-cell rows. Detect them before anything else
  // consumes the cells, and tell them apart by what the cells contain: a big
  // number over a small label is a stat, a bold title over body copy is a column.
  html = replaceInnermost(html, "tr", (m, _attrs, inner) => {
    const cells = [...inner.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)];
    if (cells.length < 2 || cells.length > 4) return m;
    if (cells.some((c) => /<(table|img|a)\b/i.test(c[2]) && !/<table[^>]*>[\s\S]*<\/table>/i.test(c[2]))) return m;

    const parsed = cells.map((c) => {
      const divs = [...c[2].matchAll(/<div\b([^>]*)>([\s\S]*?)<\/div>/gi)];
      if (divs.length < 2) return null;
      const first = decodeEntities(divs[0][2].replace(/<[^>]+>/g, " "));
      const second = decodeEntities(divs[1][2].replace(/<[^>]+>/g, " "));
      const size = Number(/font-size:\s*(\d+)px/i.exec(divs[0][1])?.[1] ?? 0);
      return first || second ? { first, second, size } : null;
    });
    if (parsed.some((p) => p === null)) return m;
    const cellsOk = parsed as Array<{ first: string; second: string; size: number }>;

    if (cellsOk.every((c) => c.size >= 20)) {
      return token({
        id: newBlockId(),
        type: "stats",
        items: cellsOk.map((c) => ({ value: c.first, label: c.second })),
      });
    }
    return token({
      id: newBlockId(),
      type: "columns",
      cells: cellsOk.map((c) => ({ title: c.first, text: c.second })),
    });
  });

  // A bordered panel → callout. Checked before the section rule below, since a
  // callout also carries a background and would otherwise be read as a band.
  html = replaceInnermost(html, "table", (m, attrs, inner) => {
    const tag = `<table${attrs}>`;
    const border = styleProp(tag, "border-left");
    if (!border) return m;
    const text = decodeEntities(inner.replace(/<[^>]+>/g, " "));
    if (!text) return m;
    return token({
      id: newBlockId(),
      type: "callout",
      text,
      bg: styleProp(tag, "background") ?? styleProp(tag, "background-color"),
      borderColor: /(#[0-9a-f]{3,8}|rgba?\([^)]+\))/i.exec(border)?.[1],
    });
  });

  // A table whose background is set and which holds a heading → section band.
  html = replaceInnermost(html, "table", (m, attrs, inner) => {
    const bg = styleProp(`<table${attrs}>`, "background") ?? styleProp(`<table${attrs}>`, "background-color");
    if (!bg || /^(none|transparent|#fff(fff)?|white)$/i.test(bg.trim())) return m;
    // A band must carry heading-sized copy. Without this, small tinted panels
    // (the cells inside a columns row) get misread as full-width sections.
    if (!/<h[1-6]\b/i.test(inner) && !/font-size:\s*(19|[2-9]\d)px/i.test(inner)) return m;
    const headingMatch = /<h[1-6]\b([^>]*)>([\s\S]*?)<\/h[1-6]>/i.exec(inner);
    const texts = [...inner.matchAll(/<(?:p|div|td)\b[^>]*>([\s\S]*?)<\/(?:p|div|td)>/gi)]
      .map((x) => decodeEntities(x[1].replace(/<[^>]+>/g, " ")))
      .filter(Boolean);
    const heading = headingMatch ? decodeEntities(headingMatch[2].replace(/<[^>]+>/g, " ")) : undefined;
    const body = texts.filter((t) => t !== heading);
    if (!heading && body.length === 0) return m;
    return token({
      id: newBlockId(),
      type: "section",
      eyebrow: body.length > 1 ? body[0] : undefined,
      heading,
      text: body.length > 1 ? body[1] : body[0],
      bg: bg.trim(),
      color: headingMatch ? styleProp(headingMatch[1], "color") : undefined,
      align: "left",
    });
  });

  return html;
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
  let cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|head)\b[\s\S]*?<\/\1>/gi, "");

  // Pull out structures the flat scanner below can't represent, replacing each
  // with a placeholder token so its position in the document is preserved.
  const extracted = new Map<string, TemplateBlock>();
  cleaned = extractStructures(cleaned, extracted);

  const blocks: TemplateBlock[] = [];
  let buffer = "";
  let bufferAlign: BlockAlign | undefined;
  // A paragraph that is nothing but one link becomes a linked text block, so the
  // destination survives the round trip instead of decaying to bare words.
  let soleLink: { label: string; url: string } | null = null;

  function flushText() {
    const text = decodeEntities(buffer);
    const url = soleLink && soleLink.label === text ? soleLink.url : undefined;
    buffer = "";
    soleLink = null;
    if (text) {
      // A run of text may contain placeholder tokens for structures lifted out
      // earlier; re-emit them in place rather than as literal "B0" text.
      if (PLACEHOLDER.test(text)) {
        for (const part of text.split(PLACEHOLDER_SPLIT)) {
          const key = PLACEHOLDER.exec(part)?.[1];
          const hit = key ? extracted.get(key) : undefined;
          if (hit) {
            blocks.push(hit);
          } else if (part.trim()) {
            blocks.push({ id: newBlockId(), type: "text", text: part.trim(), align: bufferAlign ?? "left" });
          }
        }
      } else {
        blocks.push({ id: newBlockId(), type: "text", text, align: bufferAlign ?? "left", ...(url ? { url } : {}) });
      }
    }
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
      } else if (label) {
        const href = attr(linkTag, "href");
        soleLink = buffer.trim() === "" && href ? { label, url: href } : null;
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
const LINK_COLOR = "#2E78F5";

function clampPad(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(64, Math.round(value)));
}

/**
 * A muted partner for the section's foreground colour, used for the eyebrow and
 * body text so they read as secondary against the band.
 */
function fade(color: string): string {
  return /^#f|^#e|^#ffffff$|^white$/i.test(color.trim()) ? "#9fb3d1" : "#5f6b80";
}

/**
 * Wrap already-escaped content in a link when the block has a URL. Unsafe or
 * missing URLs fall through to plain text rather than emitting a dead `href="#"`
 * that looks clickable to the recipient but goes nowhere.
 */
function linkWrap(inner: string, url: string | undefined, color: string): string {
  if (!url) return inner;
  const safe = safeUrl(url);
  if (safe === "#") return inner;
  return `<a href="${esc(safe)}" style="color:${esc(color)};text-decoration:underline;">${inner}</a>`;
}

function renderBlock(block: TemplateBlock): string {
  const align = "align" in block && block.align ? block.align : "left";
  switch (block.type) {
    case "heading": {
      const size = block.level === 1 ? 24 : 19;
      const color = block.color ?? "#0c2340";
      return `<tr><td style="padding:8px 24px;font-family:${FONT};font-size:${size}px;line-height:1.3;font-weight:bold;color:${esc(color)};text-align:${align};">${linkWrap(escText(block.text), block.url, color)}</td></tr>`;
    }
    case "text": {
      const color = block.color ?? "#3a4a63";
      return `<tr><td style="padding:8px 24px;font-family:${FONT};font-size:15px;line-height:1.6;color:${esc(color)};text-align:${align};">${linkWrap(escText(block.text), block.url, LINK_COLOR)}</td></tr>`;
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
    case "section": {
      const bg = block.bg ?? "#0c2340";
      const fg = block.color ?? "#ffffff";
      const padV = clampPad(block.padV, 16);
      const padH = clampPad(block.padH, 24);
      const rows: string[] = [];
      if (block.eyebrow) {
        rows.push(
          `<tr><td style="padding:${padV}px ${padH}px 0;font-family:${FONT};font-size:13px;line-height:1.4;color:${esc(fade(fg))};text-align:${align};">${escText(block.eyebrow)}</td></tr>`,
        );
      }
      if (block.heading) {
        const top = block.eyebrow ? 4 : padV;
        rows.push(
          `<tr><td style="padding:${top}px ${padH}px 0;font-family:${FONT};font-size:24px;line-height:1.3;font-weight:bold;color:${esc(fg)};text-align:${align};">${escText(block.heading)}</td></tr>`,
        );
      }
      if (block.text) {
        rows.push(
          `<tr><td style="padding:8px ${padH}px 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${esc(fade(fg))};text-align:${align};">${escText(block.text)}</td></tr>`,
        );
      }
      rows.push(`<tr><td style="height:${padV}px;font-size:0;line-height:0;">&nbsp;</td></tr>`);
      const band = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${esc(bg)};">${rows.join("")}</table>`;
      // Full width bleeds to the card edges; otherwise inset so the band reads as a card.
      return block.fullWidth === false
        ? `<tr><td style="padding:10px 24px;">${band}</td></tr>`
        : `<tr><td style="padding:0;">${band}</td></tr>`;
    }
    case "callout": {
      const bg = block.bg ?? "#eef4ff";
      const border = block.borderColor ?? "#2E78F5";
      const color = block.color ?? "#1d4ed8";
      return `<tr><td style="padding:10px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${esc(bg)};border-left:3px solid ${esc(border)};"><tr><td style="padding:12px 14px;font-family:${FONT};font-size:15px;line-height:1.6;color:${esc(color)};">${escText(block.text)}</td></tr></table></td></tr>`;
    }
    case "list": {
      const color = block.color ?? "#3a4a63";
      const tag = block.ordered ? "ol" : "ul";
      const items = block.items
        .filter((i) => i.trim())
        .map((i) => `<li style="padding-bottom:6px;">${escText(i)}</li>`)
        .join("");
      if (!items) return "";
      return `<tr><td style="padding:8px 24px;font-family:${FONT};font-size:15px;line-height:1.6;color:${esc(color)};"><${tag} style="margin:0;padding-left:22px;">${items}</${tag}></td></tr>`;
    }
    case "columns": {
      const cells = block.cells.slice(0, 3);
      if (cells.length === 0) return "";
      const bg = block.bg ?? "#f4f6fa";
      const width = Math.floor(100 / cells.length);
      const tds = cells
        .map((c, i) => {
          const pad = i === 0 ? "0 6px 0 0" : i === cells.length - 1 ? "0 0 0 6px" : "0 6px";
          return `<td width="${width}%" style="width:${width}%;padding:${pad};vertical-align:top;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${esc(bg)};border-radius:8px;"><tr><td style="padding:12px;font-family:${FONT};">${
            c.title ? `<div style="font-size:14px;font-weight:bold;color:#1c2434;padding-bottom:3px;">${escText(c.title)}</div>` : ""
          }${c.text ? `<div style="font-size:13px;line-height:1.6;color:#6b7a90;">${escText(c.text)}</div>` : ""}</td></tr></table></td>`;
        })
        .join("");
      // Table columns (not CSS grid/flex) so Outlook lays this out correctly.
      return `<tr><td style="padding:10px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${tds}</tr></table></td></tr>`;
    }
    case "stats": {
      const items = block.items.filter((i) => i.value.trim() || i.label.trim()).slice(0, 4);
      if (items.length === 0) return "";
      const color = block.color ?? "#0c2340";
      const width = Math.floor(100 / items.length);
      const tds = items
        .map(
          (i) =>
            `<td width="${width}%" style="width:${width}%;text-align:center;font-family:${FONT};"><div style="font-size:24px;font-weight:bold;color:${esc(color)};line-height:1.2;">${escText(i.value)}</div><div style="font-size:12px;color:#6b7a90;padding-top:2px;">${escText(i.label)}</div></td>`,
        )
        .join("");
      return `<tr><td style="padding:12px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${tds}</tr></table></td></tr>`;
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
    if (b.type === "heading" || b.type === "text") {
      // Plain-text readers can't click, so surface the destination inline.
      lines.push(b.url && safeUrl(b.url) !== "#" ? `${b.text} (${safeUrl(b.url)})` : b.text);
    }
    else if (b.type === "button") lines.push(`${b.label}: ${safeUrl(b.url)}`);
    else if (b.type === "divider") lines.push("---");
    else if (b.type === "section") {
      lines.push([b.eyebrow, b.heading, b.text].filter(Boolean).join("\n"));
    } else if (b.type === "callout") lines.push(b.text);
    else if (b.type === "list") {
      lines.push(b.items.filter((i) => i.trim()).map((i, n) => (b.ordered ? `${n + 1}. ${i}` : `- ${i}`)).join("\n"));
    } else if (b.type === "columns") {
      lines.push(b.cells.map((c) => [c.title, c.text].filter(Boolean).join(": ")).filter(Boolean).join("\n"));
    } else if (b.type === "stats") {
      lines.push(b.items.map((i) => `${i.value} ${i.label}`).join(" · "));
    }
  }
  return lines.join("\n\n").trim();
}
