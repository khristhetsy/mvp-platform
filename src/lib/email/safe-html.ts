// Headline and Body copy can be switched from Text to HTML. The choice is stored per
// template as design_html_<slot> = "1". HTML is cleaned to a short list of safe tags
// whenever the email is built, so a pasted page can never inject scripts, forms or
// event handlers. Pure and client-safe: the editor, the preview and the send share it.

export const HTML_SLOTS = ["headline", "body"] as const;

export const htmlKey = (slot: string) => `design_html_${slot}`;

export function isHtmlSlot(values: Record<string, string> | null | undefined, slot: string): boolean {
  return (HTML_SLOTS as readonly string[]).includes(slot) && values?.[htmlKey(slot)] === "1";
}

export const HEADLINE_TAGS = ["b", "strong", "i", "em", "u", "br", "span", "a"] as const;
export const BODY_TAGS = ["p", "br", "b", "strong", "i", "em", "u", "a", "ul", "ol", "li"] as const;

const BLOCK_STYLE: Record<string, string> = {
  p: "margin:0 0 14px 0;",
  ul: "margin:0 0 14px 0;padding:0 0 0 20px;",
  ol: "margin:0 0 14px 0;padding:0 0 0 20px;",
  li: "margin:0 0 8px 0;",
};

const escText = (s: string) => s.replace(/&(?!#?[a-z0-9]+;)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function attrOf(attrs: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(attrs);
  return m ? (m[1] ?? m[2] ?? "") : null;
}

/** Keep only the allowed tags, rebuilt without any attributes except a safe link or a hex color. */
export function sanitizeHtml(input: string, allowed: readonly string[]): string {
  const ok = new Set(allowed);
  const src = (input ?? "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, "");
  const out: string[] = [];
  const stack: string[] = [];
  let last = 0;
  for (const m of src.matchAll(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi)) {
    const at = m.index ?? 0;
    out.push(escText(src.slice(last, at)));
    last = at + m[0].length;
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    if (!ok.has(tag)) continue;
    if (closing) {
      const i = stack.lastIndexOf(tag);
      if (i === -1) continue;
      while (stack.length > i) out.push(`</${stack.pop()}>`);
      continue;
    }
    if (tag === "br") { out.push("<br />"); continue; }
    let attr = "";
    if (tag === "a") {
      const href = (attrOf(m[3], "href") ?? "").trim();
      if (!/^https?:\/\//i.test(href)) continue; // an unsafe link: keep its text, drop the tag
      attr = ` href="${escAttr(href)}" style="color:#1A6CE4;"`;
    } else if (tag === "span") {
      const color = /color\s*:\s*(#[0-9a-f]{6})\b/i.exec(attrOf(m[3], "style") ?? "")?.[1];
      if (color) attr = ` style="color:${color};"`;
    } else if (BLOCK_STYLE[tag]) {
      attr = ` style="${BLOCK_STYLE[tag]}"`;
    }
    stack.push(tag);
    out.push(`<${tag}${attr}>`);
  }
  out.push(escText(src.slice(last)));
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join("");
}

const inline = (s: string) => escText(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

/** Text to HTML, used when a field is switched to HTML so the words and line breaks carry over. */
export function textToHtml(value: string, slot: string): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  if (slot === "headline") return inline(v.replace(/\s*\n+\s*/g, " "));
  return v
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.split("\n").map(inline).join("<br>\n")}</p>`)
    .join("\n");
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

/** HTML to plain text, used when switching back to Text and for the subject line. */
export function htmlToText(value: string): string {
  return (value ?? "")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<\/(p|ul|ol)>/gi, "\n\n")
    .replace(/<\/li>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|nbsp|#39);/g, (e) => ENTITIES[e] ?? e)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The headline as plain text, for the subject line and the template name. */
export function plainHeadline(values: Record<string, string>): string {
  const h = values.headline ?? "";
  return (isHtmlSlot(values, "headline") ? htmlToText(h).replace(/\s+/g, " ") : h).trim();
}
