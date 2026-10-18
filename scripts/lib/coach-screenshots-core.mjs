// Pure helpers for the AI IR Coach Screenshot studio capture script. No browser, no database, so the
// rules that protect founders (demo accounts only, private data hidden) can be unit tested.

export const SCREEN = { width: 1280, height: 800 };

/**
 * Only demo or internal accounts may be captured. Mirrors isInternalAccount in
 * src/lib/notifications/internal-accounts.ts (any @myicfos.com address). A test keeps them in step.
 * @param {string | null | undefined} email
 */
export function isDemoAccountEmail(email) {
  const domain = String(email ?? "").trim().toLowerCase().split("@")[1] ?? "";
  return domain === "myicfos.com";
}

/**
 * What gets blurred before an image is saved. Sources are strings so the same patterns run inside
 * the browser page. Dates such as 2026-10-18 are not matched as phone numbers.
 */
export const PRIVATE_SOURCES = [
  { kind: "email", source: "[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}", flags: "gi" },
  { kind: "phone", source: "(?:\\+\\d{1,3}[\\s.-]?)?(?:\\(\\d{3}\\)|\\d{3})[\\s.-]\\d{3}[\\s.-]\\d{4}", flags: "g" },
  { kind: "amount", source: "[$€£]\\s?\\d[\\d,]*(?:\\.\\d+)?(?:\\s?[KMB])?", flags: "g" },
];

/**
 * @param {string} text
 * @returns {Array<{ start: number, end: number, kind: string }>}
 */
export function findPrivateSpans(text) {
  const spans = [];
  for (const { kind, source, flags } of PRIVATE_SOURCES) {
    const re = new RegExp(source, flags);
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      spans.push({ start: m.index, end: m.index + m[0].length, kind });
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}

/**
 * Text used to decide whether a screen changed. Private values are masked and digit runs collapsed,
 * so a new demo email or "3 days ago" becoming "4 days ago" does not flag a screen as stale, while a
 * changed label, a moved section or a new button does.
 * @param {string} text
 */
export function normalizeForHash(text) {
  let out = String(text ?? "");
  for (const { source, flags } of PRIVATE_SOURCES) out = out.replace(new RegExp(source, flags), " ");
  return out.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
}

/** Storage path for one versioned capture. */
export function capturePath(input) {
  const stamp = new Date(input.capturedAt).toISOString().replace(/[:.]/g, "-");
  return `${input.courseSlug}/${input.lessonId}/${input.stepIndex}/${stamp}.png`;
}

/**
 * The row update after a capture attempt. A failure keeps the previous image and records why, which
 * flags the step for a fix. A success clears the error and the pending request.
 * @param {{ ok: true, imagePath: string, contentHash: string, capturedAt: string, appVersion: string, pinned: boolean } | { ok: false, error: string }} result
 */
export function rowUpdateAfterCapture(result) {
  if (!result.ok) return { capture_error: result.error.slice(0, 300), capture_requested_at: null };
  return {
    image_path: result.imagePath,
    content_hash: result.contentHash,
    captured_at: result.capturedAt,
    app_version: result.appVersion,
    pinned: result.pinned,
    capture_error: null,
    capture_requested_at: null,
  };
}
