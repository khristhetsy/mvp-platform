"use client";

// Renders an email body. If HTML is present it's shown in a sandboxed iframe so
// images and formatting display like a normal mail client, while the email's
// scripts are disabled (no `allow-scripts`) and its CSS can't leak into the app.
// `allow-same-origin` is used only to measure height (safe without scripts);
// links open in a new tab. Falls back to plain text when there's no HTML.

import { useCallback, useEffect, useRef, useState } from "react";

export function EmailBody({ html, text }: { html?: string | null; text?: string | null }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const obsRef = useRef<ResizeObserver | null>(null);
  const [height, setHeight] = useState(60);

  const measure = useCallback(() => {
    const doc = ref.current?.contentDocument;
    const h = doc?.body?.scrollHeight ?? doc?.documentElement?.scrollHeight;
    if (h && h > 0) setHeight(Math.min(h + 8, 6000));
  }, []);

  const onLoad = useCallback(() => {
    measure();
    const doc = ref.current?.contentDocument;
    if (doc?.body && typeof ResizeObserver !== "undefined") {
      obsRef.current?.disconnect();
      const ro = new ResizeObserver(() => measure());
      ro.observe(doc.body);
      obsRef.current = ro;
    }
    // Re-measure as images finish loading (they enlarge the body after onLoad).
    doc?.querySelectorAll("img").forEach((img) => img.addEventListener("load", measure));
  }, [measure]);

  useEffect(() => () => obsRef.current?.disconnect(), []);

  if (!html) {
    return <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{text ?? ""}</p>;
  }

  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>
    :root{color-scheme:light only}
    html,body{margin:0;padding:0}
    body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:14px;line-height:1.6;color:#1e293b;word-break:break-word;overflow-x:hidden}
    img{max-width:100%;height:auto}
    table{max-width:100%}
    a{color:#185FA5}
  </style></head><body>${html}</body></html>`;

  return (
    <iframe
      ref={ref}
      title="Email content"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={srcDoc}
      onLoad={onLoad}
      className="w-full border-0 bg-white"
      style={{ height }}
    />
  );
}
