// What goes with a founder's manual outreach email: the one pager as a PDF,
// the one pager link, and PDFs from the founder's own data room.
//
// The pure helpers (normalize, link line) are shared with the client; the
// loader that downloads files lives in manual-attachments.server.ts.

export type ManualAttachments = {
  /** Attach the one pager, generated as a PDF from the company profile. */
  onePagerPdf: boolean;
  /** Add the online one pager link (/f/<slug>) to the email. */
  onePagerLink: boolean;
  /** Data room documents (PDF) to attach, by documents.id. */
  documentIds: string[];
};

/** New campaigns attach the one pager PDF and nothing else. */
export const DEFAULT_ATTACHMENTS: ManualAttachments = { onePagerPdf: true, onePagerLink: false, documentIds: [] };

/** Resend caps a message at 40 MB; stay well under so a batch never bounces. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function normalizeAttachments(value: unknown): ManualAttachments {
  if (!value || typeof value !== "object") return { ...DEFAULT_ATTACHMENTS };
  const v = value as Record<string, unknown>;
  return {
    onePagerPdf: typeof v.onePagerPdf === "boolean" ? v.onePagerPdf : DEFAULT_ATTACHMENTS.onePagerPdf,
    onePagerLink: v.onePagerLink === true,
    documentIds: Array.isArray(v.documentIds)
      ? [...new Set(v.documentIds.filter((id): id is string => typeof id === "string" && id.length > 0))].slice(0, 10)
      : [],
  };
}

/**
 * With the link option on, make sure the email carries the one pager link: when
 * the body does not already use {{founder_preview}}, add a line for it.
 */
export function withOnePagerLink(body: string, att: ManualAttachments): string {
  if (!att.onePagerLink || body.includes("{{founder_preview}}")) return body;
  return `${body.replace(/\s+$/, "")}\n\nOne pager: {{founder_preview}}`;
}
