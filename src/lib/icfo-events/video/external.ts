// "Bring your own link" live mode: an admin pastes any live stream / meeting URL
// (YouTube Live, Zoom, Google Meet, a manually-created Whereby room, etc.). No
// API key or vendor required — fully internal. Known-embeddable hosts render in
// an iframe; everything else gets a "Join live session" link (Zoom/Meet block
// iframing, so a link is the only reliable option there).

export function isHttpUrl(u: string): boolean {
  try {
    const x = new URL(u);
    return x.protocol === "https:" || x.protocol === "http:";
  } catch {
    return false;
  }
}

/** Returns an iframe-embeddable URL for known hosts, or null if the link should
 *  open in a new tab instead. */
export function embeddableLiveUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host.endsWith("whereby.com")) {
      return url.includes("?") ? `${url}&embed` : `${url}?embed`;
    }
    if (host.endsWith("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
    return null;
  } catch {
    return null;
  }
}
