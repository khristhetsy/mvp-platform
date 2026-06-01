import type { EmailDraft, EmailTemplateDefinition } from "@/lib/email/types";

export function formatDraftForClipboard(draft: EmailDraft): string {
  const to = draft.recipients.map((r) => r.email).join(", ") || "(add recipient)";
  const cc = draft.cc.length ? `\nCc: ${draft.cc.map((r) => r.email).join(", ")}` : "";
  return `Subject: ${draft.subject}\nTo: ${to}${cc}\n\n${draft.body}`;
}

export function templateSelectOptions(templates: EmailTemplateDefinition[]) {
  return templates.map((t) => ({ value: t.type, label: t.label, description: t.description }));
}
