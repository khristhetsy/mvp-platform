import type { ReactNode } from "react";

// Minimal inline formatter for step bodies: **bold** and `code`. Escapes first,
// so it is safe to render the resulting fragments.
export function renderInline(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      nodes.push(<strong key={key++} style={{ fontWeight: 600, color: "#0f2147" }}>{tok.slice(2, -2)}</strong>);
    } else {
      nodes.push(<code key={key++} style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.9em", background: "#eef1f5", padding: "1px 5px", borderRadius: 4, color: "#185FA5" }}>{tok.slice(1, -1)}</code>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
