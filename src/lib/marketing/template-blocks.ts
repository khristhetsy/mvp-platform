// Block model for the visual template editor.
//
// The editor manipulates these blocks; `renderBlocksToEmailHtml` regenerates the
// email HTML from them. Output is deliberately old-school email HTML —
// table-based layout with inline styles — because Outlook/Gmail ignore most
// modern CSS. Editing visually can therefore never produce markup that breaks in
// a mail client, which is the whole point of a scoped block editor.

export type BlockAlign = "left" | "center" | "right";

/**
 * Styling available on every block. All optional — a block that sets none of
 * these renders exactly as it did before these fields existed.
 */
export type BlockStyle = {
  /** Vertical / horizontal padding in px. */
  padV?: number;
  padH?: number;
  radius?: number;
  border?: "none" | "full" | "left";
  borderColor?: string;
  /**
   * Hidden on narrow screens via a media query. Honoured by Apple Mail, iOS
   * Mail, and most webmail; Outlook desktop ignores media queries and will show
   * the block regardless.
   */
  hideOnMobile?: boolean;
  background?: string;
};

export type TemplateBlock = BlockStyle &
  (| {
      id: string;
      type: "heading";
      text: string;
      level: 1 | 2;
      color?: string;
      align?: BlockAlign;
      url?: string;
      /** Explicit px size. Overrides the size implied by `level`. */
      size?: number;
    }
  | {
      id: string;
      type: "text";
      text: string;
      color?: string;
      align?: BlockAlign;
      url?: string;
      size?: number;
      bold?: boolean;
      /** Line height as a multiplier, e.g. 1.6. */
      leading?: number;
    }
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
      headingSize?: number;
      url?: string;
    }
  | { id: string; type: "callout"; text: string; bg?: string; borderColor?: string; color?: string; size?: number }
  | { id: string; type: "list"; items: string[]; ordered?: boolean; color?: string; size?: number }
  | {
      id: string;
      type: "columns";
      cells: Array<{ title?: string; text?: string; url?: string }>;
      bg?: string;
      size?: number;
    }
  | { id: string; type: "stats"; items: Array<{ value: string; label: string }>; color?: string; size?: number }
  | { id: string; type: "quote"; text: string; attribution?: string; color?: string; size?: number }
  | {
      id: string;
      type: "profile";
      name: string;
      role?: string;
      blurb?: string;
      avatar?: string;
      url?: string;
      size?: number;
    }
  // Video can't play inside an email, so this is a poster image that links out.
  | { id: string; type: "video"; thumbnail: string; url: string; caption?: string; width?: number }
  | { id: string; type: "social"; links: Array<{ network: SocialNetwork; url: string }>; color?: string }
  | {
      id: string;
      type: "signature";
      name: string;
      title?: string;
      company?: string;
      email?: string;
      phone?: string;
      avatar?: string;
      size?: number;
    });

/**
 * Patch shape for editing a block in place.
 *
 * Deliberately NOT `Partial<TemplateBlock>`: that distributes over a sixteen-member
 * union intersected with BlockStyle, and the editor applies it at ~60 call sites,
 * which makes the type checker do an enormous amount of redundant work. The
 * editor already knows which block is selected before it patches, so a loose
 * record here costs no real safety and keeps the build cheap.
 */
export type BlockPatch = Partial<BlockStyle> & Record<string, unknown>;

export const SOCIAL_NETWORKS = ["linkedin", "x", "facebook", "instagram", "youtube", "website"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

const SOCIAL_LABEL: Record<SocialNetwork, string> = {
  linkedin: "LinkedIn",
  x: "X",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  website: "Website",
};

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

export type EmailTheme = {
  fontFamily: string;
  contentWidth: number;
  pageBg: string;
  cardBg: string;
  linkColor: string;
  baseLeading: number;
  headingColor: string;
  textColor: string;
};

const FALLBACK_THEME: EmailTheme = {
  fontFamily: "Helvetica, Arial, sans-serif",
  contentWidth: 600,
  pageBg: "#f6f8fc",
  cardBg: "#ffffff",
  linkColor: "#2E78F5",
  baseLeading: 1.6,
  headingColor: "#0c2340",
  textColor: "#3a4a63",
};

/** Font sizes are literal px — mail clients handle em/rem inconsistently. */
function clampSize(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(10, Math.min(48, Math.round(value)));
}

function clampLeading(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 1.6;
  return Math.max(1, Math.min(2.4, Math.round(value * 10) / 10));
}

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

function renderBlock(block: TemplateBlock, t: EmailTheme = FALLBACK_THEME): string {
  const FONT = t.fontFamily;
  const LINK_COLOR = t.linkColor;
  const align = "align" in block && block.align ? block.align : "left";
  switch (block.type) {
    case "heading": {
      const size = clampSize(block.size, block.level === 1 ? 24 : 19);
      const color = block.color ?? t.headingColor;
      return `<tr><td style="padding:8px 24px;font-family:${FONT};font-size:${size}px;line-height:1.3;font-weight:bold;color:${esc(color)};text-align:${align};">${linkWrap(escText(block.text), block.url, color)}</td></tr>`;
    }
    case "text": {
      const color = block.color ?? t.textColor;
      const size = clampSize(block.size, 15);
      const leading = clampLeading(block.leading ?? t.baseLeading);
      const weight = block.bold ? "bold" : "normal";
      return `<tr><td style="padding:8px 24px;font-family:${FONT};font-size:${size}px;line-height:${leading};font-weight:${weight};color:${esc(color)};text-align:${align};">${linkWrap(escText(block.text), block.url, LINK_COLOR)}</td></tr>`;
    }
    case "button": {
      const bg = block.bg ?? t.linkColor;
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
      const headingSize = clampSize(block.headingSize, 24);
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
          `<tr><td style="padding:${top}px ${padH}px 0;font-family:${FONT};font-size:${headingSize}px;line-height:1.3;font-weight:bold;color:${esc(fg)};text-align:${align};">${linkWrap(escText(block.heading), block.url, fg)}</td></tr>`,
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
      const size = clampSize(block.size, 15);
      return `<tr><td style="padding:10px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${esc(bg)};border-left:3px solid ${esc(border)};"><tr><td style="padding:12px 14px;font-family:${FONT};font-size:${size}px;line-height:1.6;color:${esc(color)};">${escText(block.text)}</td></tr></table></td></tr>`;
    }
    case "list": {
      const color = block.color ?? "#3a4a63";
      const tag = block.ordered ? "ol" : "ul";
      const size = clampSize(block.size, 15);
      const items = block.items
        .filter((i) => i.trim())
        .map((i) => `<li style="padding-bottom:6px;">${escText(i)}</li>`)
        .join("");
      if (!items) return "";
      return `<tr><td style="padding:8px 24px;font-family:${FONT};font-size:${size}px;line-height:1.6;color:${esc(color)};"><${tag} style="margin:0;padding-left:22px;">${items}</${tag}></td></tr>`;
    }
    case "columns": {
      const cells = block.cells.slice(0, 3);
      if (cells.length === 0) return "";
      const bg = block.bg ?? "#f4f6fa";
      const width = Math.floor(100 / cells.length);
      const size = clampSize(block.size, 13);
      const tds = cells
        .map((c, i) => {
          const pad = i === 0 ? "0 6px 0 0" : i === cells.length - 1 ? "0 0 0 6px" : "0 6px";
          return `<td width="${width}%" style="width:${width}%;padding:${pad};vertical-align:top;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${esc(bg)};border-radius:8px;"><tr><td style="padding:12px;font-family:${FONT};">${
            c.title ? `<div style="font-size:${size + 1}px;font-weight:bold;color:#1c2434;padding-bottom:3px;">${linkWrap(escText(c.title), c.url, LINK_COLOR)}</div>` : ""
          }${c.text ? `<div style="font-size:${size}px;line-height:1.6;color:#6b7a90;">${escText(c.text)}</div>` : ""}</td></tr></table></td>`;
        })
        .join("");
      // Table columns (not CSS grid/flex) so Outlook lays this out correctly.
      return `<tr><td style="padding:10px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${tds}</tr></table></td></tr>`;
    }
    case "quote": {
      const color = block.color ?? "#1c2434";
      const size = clampSize(block.size, 18);
      const attribution = block.attribution
        ? `<div style="padding-top:8px;font-family:${FONT};font-size:13px;color:#6b7a90;">— ${escText(block.attribution)}</div>`
        : "";
      return `<tr><td style="padding:14px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-left:3px solid #d3d9e4;padding:4px 0 4px 16px;font-family:${FONT};font-size:${size}px;line-height:1.5;font-style:italic;color:${esc(color)};">${escText(block.text)}${attribution}</td></tr></table></td></tr>`;
    }
    case "profile": {
      const size = clampSize(block.size, 15);
      const avatar = block.avatar && safeUrl(block.avatar) !== "#"
        ? `<td width="56" style="width:56px;vertical-align:top;padding-right:12px;"><img src="${esc(safeUrl(block.avatar))}" alt="" width="56" style="display:block;width:56px;height:56px;border-radius:28px;border:0;" /></td>`
        : "";
      const name = linkWrap(escText(block.name), block.url, LINK_COLOR);
      return `<tr><td style="padding:12px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${avatar}<td style="vertical-align:top;font-family:${FONT};"><div style="font-size:${size + 1}px;font-weight:bold;color:#1c2434;">${name}</div>${
        block.role ? `<div style="font-size:${size - 2}px;color:#6b7a90;padding-top:2px;">${escText(block.role)}</div>` : ""
      }${
        block.blurb ? `<div style="font-size:${size - 1}px;line-height:1.6;color:#3a4a63;padding-top:6px;">${escText(block.blurb)}</div>` : ""
      }</td></tr></table></td></tr>`;
    }
    case "video": {
      const thumb = safeUrl(block.thumbnail);
      if (!block.thumbnail || thumb === "#") return "";
      const width = block.width && block.width > 0 ? Math.min(block.width, 600) : 480;
      const img = `<img src="${esc(thumb)}" alt="${esc(block.caption ?? "Watch the video")}" width="${width}" style="display:inline-block;max-width:100%;height:auto;border:0;border-radius:8px;" />`;
      const caption = block.caption
        ? `<div style="padding-top:6px;font-family:${FONT};font-size:12px;color:#6b7a90;">${escText(block.caption)}</div>`
        : "";
      return `<tr><td style="padding:12px 24px;text-align:center;">${linkWrap(img, block.url, LINK_COLOR)}${caption}</td></tr>`;
    }
    case "social": {
      const links = block.links.filter((l) => l.url && safeUrl(l.url) !== "#");
      if (links.length === 0) return "";
      const color = block.color ?? LINK_COLOR;
      // Text labels, not icon images: hosted icons are the most common cause of
      // a broken-image row when a CDN path rots.
      const items = links
        .map(
          (l) =>
            `<a href="${esc(safeUrl(l.url))}" style="display:inline-block;padding:0 8px;font-family:${FONT};font-size:13px;color:${esc(color)};text-decoration:none;">${esc(SOCIAL_LABEL[l.network] ?? l.network)}</a>`,
        )
        .join('<span style="color:#c9d2e0;">·</span>');
      return `<tr><td style="padding:12px 24px;text-align:center;">${items}</td></tr>`;
    }
    case "signature": {
      const size = clampSize(block.size, 14);
      const avatar = block.avatar && safeUrl(block.avatar) !== "#"
        ? `<td width="48" style="width:48px;vertical-align:top;padding-right:12px;"><img src="${esc(safeUrl(block.avatar))}" alt="" width="48" style="display:block;width:48px;height:48px;border-radius:24px;border:0;" /></td>`
        : "";
      const lines = [
        block.title ? `<div style="font-size:${size - 1}px;color:#6b7a90;">${escText(block.title)}</div>` : "",
        block.company ? `<div style="font-size:${size - 1}px;color:#6b7a90;">${escText(block.company)}</div>` : "",
        block.email
          ? `<div style="font-size:${size - 1}px;padding-top:3px;"><a href="mailto:${esc(block.email)}" style="color:${LINK_COLOR};text-decoration:none;">${escText(block.email)}</a></div>`
          : "",
        block.phone ? `<div style="font-size:${size - 1}px;color:#6b7a90;">${escText(block.phone)}</div>` : "",
      ].join("");
      return `<tr><td style="padding:14px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${avatar}<td style="vertical-align:top;font-family:${FONT};"><div style="font-size:${size}px;font-weight:bold;color:#1c2434;">${escText(block.name)}</div>${lines}</td></tr></table></td></tr>`;
    }
    case "stats": {
      const items = block.items.filter((i) => i.value.trim() || i.label.trim()).slice(0, 4);
      if (items.length === 0) return "";
      const color = block.color ?? "#0c2340";
      const width = Math.floor(100 / items.length);
      const size = clampSize(block.size, 24);
      const tds = items
        .map(
          (i) =>
            `<td width="${width}%" style="width:${width}%;text-align:center;font-family:${FONT};"><div style="font-size:${size}px;font-weight:bold;color:${esc(color)};line-height:1.2;">${escText(i.value)}</div><div style="font-size:12px;color:#6b7a90;padding-top:2px;">${escText(i.label)}</div></td>`,
        )
        .join("");
      return `<tr><td style="padding:12px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${tds}</tr></table></td></tr>`;
    }
    default:
      return "";
  }
}

const HIDE_ON_MOBILE_CLASS = "icapos-hm";

/**
 * Wrap a rendered row so per-block styling applies. Blocks that set none of the
 * style fields pass straight through, keeping output byte-identical to before.
 */
function applyBlockStyle(row: string, block: TemplateBlock): string {
  if (!row) return row;
  const hasBox =
    block.background || block.radius !== undefined || (block.border && block.border !== "none");
  const hasPad = block.padV !== undefined || block.padH !== undefined;

  let out = row;
  if (hasBox || hasPad) {
    const styles: string[] = [];
    if (block.background) styles.push(`background:${esc(block.background)}`);
    if (block.radius !== undefined) styles.push(`border-radius:${clampPad(block.radius, 0)}px`);
    if (block.border === "full") styles.push(`border:1px solid ${esc(block.borderColor ?? "#e3e8f2")}`);
    if (block.border === "left") styles.push(`border-left:3px solid ${esc(block.borderColor ?? "#2E78F5")}`);
    if (hasPad) styles.push(`padding:${clampPad(block.padV, 0)}px ${clampPad(block.padH, 0)}px`);
    out = `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${styles.join(";")};">${out}</table></td></tr>`;
  }

  if (block.hideOnMobile) {
    // Needs the class on a <tr>; wrap when the row isn't already a bare <tr>.
    out = out.replace(/^<tr(\s|>)/i, `<tr class="${HIDE_ON_MOBILE_CLASS}"$1`);
  }
  return out;
}

/** Render blocks to email-safe HTML (table layout + inline styles). */
export function renderBlocksToEmailHtml(blocks: TemplateBlock[], theme?: Partial<EmailTheme>): string {
  const t = { ...FALLBACK_THEME, ...(theme ?? {}) };
  const rows = blocks.map((b) => applyBlockStyle(renderBlock(b, t), b)).join("");
  const needsMobileRule = blocks.some((b) => b.hideOnMobile);
  // A single <style> block carries the only rule that can't be inlined. Outlook
  // desktop ignores it and shows the block; everything else honours it.
  const mobileStyle = needsMobileRule
    ? `<style>@media only screen and (max-width:600px){.${HIDE_ON_MOBILE_CLASS}{display:none!important;max-height:0!important;overflow:hidden!important;}}</style>`
    : "";
  return [
    mobileStyle,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${esc(t.pageBg)};padding:24px 0;">`,
    `<tr><td align="center">`,
    `<table role="presentation" width="${t.contentWidth}" cellpadding="0" cellspacing="0" border="0" style="width:${t.contentWidth}px;max-width:100%;background:${esc(t.cardBg)};border-radius:10px;">`,
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
    } else if (b.type === "quote") {
      lines.push(b.attribution ? `"${b.text}" — ${b.attribution}` : `"${b.text}"`);
    } else if (b.type === "profile") {
      lines.push([b.name, b.role, b.blurb].filter(Boolean).join("\n"));
    } else if (b.type === "video") {
      lines.push(`${b.caption ?? "Watch the video"}: ${safeUrl(b.url)}`);
    } else if (b.type === "social") {
      lines.push(b.links.filter((l) => safeUrl(l.url) !== "#").map((l) => `${l.network}: ${safeUrl(l.url)}`).join("\n"));
    } else if (b.type === "signature") {
      lines.push([b.name, b.title, b.company, b.email, b.phone].filter(Boolean).join("\n"));
    }
  }
  return lines.join("\n\n").trim();
}
