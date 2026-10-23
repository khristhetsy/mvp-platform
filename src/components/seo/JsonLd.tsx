/** Renders a JSON-LD <script> block for structured data (App Router safe). */

// JSON.stringify does not escape "<", so text like "</script><script>..." inside a
// title or description would close the tag and run as page script. Escaping "<" (and
// the two line separators that break older parsers) keeps the JSON identical once
// parsed while making it impossible to break out of the script element.
function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function JsonLd({ data }: Readonly<{ data: Record<string, unknown> }>) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
