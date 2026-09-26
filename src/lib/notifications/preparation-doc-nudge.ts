/**
 * Ready to Match document nudge: tells a founder stalled in Preparation exactly
 * which required documents are missing, which are done, and where to build
 * each missing one. Pure (no I/O) so the copy is testable. Uses the same
 * required list and matching as the Preparation checklist.
 */
import { QUALIFY_REQUIRED_DOCUMENTS, isQualifyDocSatisfied } from "@/lib/founder-journey/documents";
import { absoluteUrl, button, escapeHtml, shell } from "@/lib/activity/email-templates";

export type UploadedDoc = { document_type: string | null; created_at: string | null };

/** The tool that builds each required document. */
const TOOL_BY_CODE: Record<string, { how: string; path: string }> = {
  PITCH_DECK: { how: "Build it in the Pitch deck tool, then upload it", path: "/founder/pitch-deck" },
  FINANCIAL_STATEMENTS: { how: "Build them in the Financial model tool, then export and upload", path: "/founder/financial-model" },
  CAP_TABLE: { how: "Build it in the Cap table tool, then export and upload", path: "/founder/cap-table" },
};

export const PREPARATION_PATH = "/founder/stages/preparation";

export type DocStatus = { code: string; label: string; done: boolean; uploadedAt: string | null; how: string; path: string };

export function preparationDocStatus(uploads: UploadedDoc[]): DocStatus[] {
  return QUALIFY_REQUIRED_DOCUMENTS.map((doc) => {
    const matches = uploads.filter((u) => isQualifyDocSatisfied([u.document_type], doc));
    const first = matches
      .map((u) => u.created_at)
      .filter((d): d is string => Boolean(d))
      .sort()[0] ?? null;
    const tool = TOOL_BY_CODE[doc.code] ?? { how: "Upload it on your Preparation page", path: PREPARATION_PATH };
    return { code: doc.code, label: doc.label, done: matches.length > 0, uploadedAt: first, ...tool };
  });
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export type PreparationDocNudge = { title: string; message: string; subject: string; html: string; text: string };

/**
 * Null when every required document is in (the founder is held by something
 * else, so the general Preparation nudge applies instead).
 */
export function buildPreparationDocNudge(input: {
  firstName: string | null;
  companyName: string | null;
  uploads: UploadedDoc[];
}): PreparationDocNudge | null {
  const status = preparationDocStatus(input.uploads);
  const missing = status.filter((s) => !s.done);
  if (missing.length === 0) return null;

  const total = status.length;
  const doneCount = total - missing.length;
  const left = missing.length === 1 ? "1 document left" : `${missing.length} documents left`;
  const title = `${left} before investor matching`;
  const company = input.companyName?.trim() || null;
  const subject = company ? `${title}, ${company}` : title;

  const missingText = joinLabels(missing.map((m) => m.label.toLowerCase()));
  const done = status.filter((s) => s.done).map((s) => s.label.toLowerCase());
  const message =
    doneCount === 0
      ? `Add your ${missingText}. Start with the one you have.`
      : `Add your ${missingText}. Your ${joinLabels(done)} ${done.length === 1 ? "is" : "are"} in.`;

  const name = input.firstName?.trim() || "there";
  const who = company ?? "Your company";
  const intro =
    doneCount === 0
      ? `${who} is one step from investor matching. Add the ${total} required documents and iCFO reviews your Preparation for matching.`
      : `${who} is one step from investor matching. You have ${doneCount} of the ${total} required documents in. Add the other ${missing.length} and iCFO reviews your Preparation for matching.`;

  const rows = status
    .map((s) => {
      const pill = s.done
        ? `<span style="background:#E3F4EC;color:#177A52;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:bold;">Done</span>`
        : `<span style="background:#FBF0DD;color:#A35A00;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:bold;">Missing</span>`;
      const detail = s.done
        ? s.uploadedAt ? `Uploaded ${day(s.uploadedAt)}` : "Uploaded"
        : s.how;
      const link = s.done
        ? ""
        : `<a href="${escapeHtml(absoluteUrl(s.path))}" style="color:#1A6CE4;font-weight:bold;text-decoration:none;font-size:13px;">Open tool</a>`;
      return `<tr><td style="padding:10px 12px;border-top:1px solid #E3E8F2;width:1%;white-space:nowrap;">${pill}</td><td style="padding:10px 12px;border-top:1px solid #E3E8F2;"><b>${escapeHtml(s.label)}</b><br><span style="color:#5A6782;font-size:13px;">${escapeHtml(detail)}</span></td><td style="padding:10px 12px;border-top:1px solid #E3E8F2;text-align:right;white-space:nowrap;">${link}</td></tr>`;
    })
    .join("");

  const prepUrl = absoluteUrl(PREPARATION_PATH);
  const html = shell(
    `<p style="margin:0 0 12px;">Hi ${escapeHtml(name)},</p>` +
      `<p style="margin:0 0 16px;">${escapeHtml(intro)}</p>` +
      `<table style="width:100%;border-collapse:collapse;border:1px solid #E3E8F2;border-radius:8px;margin:0 0 18px;">${rows}</table>` +
      `<div>${button("Finish my documents", prepUrl, true)}</div>` +
      `<p style="margin:12px 0 0;color:#667;font-size:12px;">Every plan includes all tools. iCapOS is not a broker dealer and does not raise capital or guarantee funding.</p>`,
  );

  const lines = status.map((s) => (s.done ? `Done: ${s.label}` : `Missing: ${s.label}. ${s.how}: ${absoluteUrl(s.path)}`));
  const text = [`Hi ${name},`, "", intro, "", ...lines, "", `Finish my documents: ${prepUrl}`].join("\n");

  return { title, message, subject, html, text };
}
