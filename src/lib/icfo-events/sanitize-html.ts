// Minimal allowlist sanitizer for the staff-authored event banner. Only admins
// and analysts can write this HTML (behind manage_events), but we still strip
// scripts, event handlers, and dangerous URLs so a compromised staff account
// or a paste of hostile markup can't inject active content on a public page.

const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li",
  "h2", "h3", "h4", "blockquote", "span", "div",
]);

// Attributes we keep, per tag. href is validated separately.
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
};

function safeHref(value: string): string | null {
  const v = value.trim();
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  if (v.startsWith("/") || v.startsWith("#")) return v;
  return null;
}

/**
 * Sanitize banner HTML down to a small formatting allowlist. Unknown tags are
 * unwrapped (their text kept); disallowed attributes and any on* handlers are
 * dropped. Not a full HTML parser — deliberately conservative.
 */
export function sanitizeBannerHtml(input: string | null | undefined): string {
  if (!input) return "";
  let html = String(input);

  // Hard-remove script/style/iframe/object blocks entirely (with content).
  html = html.replace(/<(script|style|iframe|object|embed|form)[\s\S]*?<\/\1>/gi, "");
  html = html.replace(/<(script|style|iframe|object|embed|form)[^>]*\/?>/gi, "");

  // Walk every tag; keep allowed ones with filtered attributes, unwrap the rest.
  html = html.replace(/<(\/?)([a-zA-Z0-9]+)([^>]*)>/g, (_m, close: string, tagRaw: string, attrs: string) => {
    const tag = tagRaw.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return ""; // unwrap: drop the tag, keep inner text
    if (close) return `</${tag}>`;

    const allowed = ALLOWED_ATTRS[tag] ?? new Set<string>();
    let kept = "";
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(attrs)) !== null) {
      const name = a[1].toLowerCase();
      if (name.startsWith("on")) continue;
      if (!allowed.has(name)) continue;
      let val = a[2].replace(/^['"]|['"]$/g, "");
      if (name === "href") {
        const safe = safeHref(val);
        if (!safe) continue;
        val = safe;
      }
      kept += ` ${name}="${val.replace(/"/g, "&quot;")}"`;
    }
    // Force external links to open safely.
    if (tag === "a" && /href=/.test(kept) && !/target=/.test(kept)) {
      kept += ` target="_blank" rel="noopener noreferrer"`;
    }
    return `<${tag}${kept}>`;
  });

  return html.trim();
}

/** Allowed background presets for the banner (keeps arbitrary CSS out). */
export const BANNER_BACKGROUNDS = ["indigo", "teal", "navy", "plain"] as const;
export type BannerBackground = (typeof BANNER_BACKGROUNDS)[number];

export function normalizeBannerBg(v: string | null | undefined): BannerBackground {
  return (BANNER_BACKGROUNDS as readonly string[]).includes(String(v)) ? (v as BannerBackground) : "indigo";
}
