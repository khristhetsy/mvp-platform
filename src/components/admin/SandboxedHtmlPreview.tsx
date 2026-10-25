"use client";

import { useCallback, useState, type CSSProperties, type SyntheticEvent } from "react";

/**
 * Shows stored HTML (email templates, report bodies) inside a sandboxed frame so it
 * can look exactly like the email but can never run code in an admin's session.
 *
 * sandbox="allow-same-origin" and nothing else: no scripts, no forms, no popups, no
 * top navigation. Scripts stay blocked, so keeping the same origin is safe and lets the
 * parent measure the content to size the frame. A <base target="_blank"> plus the
 * missing allow-popups makes links in the preview do nothing.
 */
export function SandboxedHtmlPreview({
  html,
  title = "Preview",
  minHeight = 80,
  maxHeight,
  padding = 0,
  fontSize = 14,
  color = "#222222",
  showBadge = true,
  fluidOnPhone = false,
  style,
}: Readonly<{
  html: string;
  title?: string;
  minHeight?: number;
  maxHeight?: number;
  padding?: number;
  fontSize?: number;
  color?: string;
  showBadge?: boolean;
  /** Preview only: on a phone-width frame, shrink images and tables to fit. The stored HTML is never changed. */
  fluidOnPhone?: boolean;
  style?: CSSProperties;
}>) {
  const [height, setHeight] = useState(minHeight);

  const measure = useCallback(
    (e: SyntheticEvent<HTMLIFrameElement>) => {
      try {
        const doc = e.currentTarget.contentDocument;
        const h = doc?.documentElement?.scrollHeight ?? doc?.body?.scrollHeight ?? 0;
        if (h > 0) setHeight(Math.max(minHeight, maxHeight ? Math.min(h, maxHeight) : h));
      } catch {
        // Measuring is best effort; the frame keeps its minimum height and scrolls.
      }
    },
    [minHeight, maxHeight],
  );

  const base =
    `<base target="_blank"><style>html,body{margin:0}body{padding:${padding}px;` +
    `font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:${fontSize}px;` +
    `line-height:1.6;color:${color}}</style>` +
    (fluidOnPhone ? `<style>@media(max-width:639px){img,table{max-width:100%!important}img{height:auto!important}}</style>` : "");

  return (
    <div>
      {showBadge ? (
        <div style={{ textAlign: "right", fontSize: 11, color: "#5F5E5A", padding: "0 0 4px" }}>Scripts blocked</div>
      ) : null}
      <iframe
        title={title}
        sandbox="allow-same-origin"
        srcDoc={base + html}
        onLoad={measure}
        style={{ display: "block", width: "100%", border: 0, background: "transparent", height, ...style }}
      />
    </div>
  );
}
