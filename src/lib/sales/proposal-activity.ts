// Pure builder for the timeline entry written when a Contracts send goes out.
// No IO, unit-tested. The entry links to the first sent document, whose admin
// page shows the tracking, activity and PDFs for the send.

export type ProposalActivityInput = {
  subject: string;
  delivered: boolean;
  via?: "gmail" | "icapos";
  packetId: string;
  documentIds: string[];
};

export function proposalActivity(i: ProposalActivityInput): { summary: string; meta: Record<string, unknown> } {
  const subject = i.subject.trim().slice(0, 160);
  const label = i.delivered ? "Proposal sent" : "Proposal not delivered";
  const first = i.documentIds[0];
  return {
    summary: `${label}${subject ? `: ${subject}` : ""}`,
    meta: {
      ...(i.via ? { via: i.via } : {}),
      packetId: i.packetId,
      documentIds: i.documentIds,
      delivered: i.delivered,
      ...(first ? { href: `/admin/sales/contracts/${first}` } : {}),
    },
  };
}

/** Only in-app admin paths are ever rendered as links from log metadata. */
export function safeInternalHref(v: unknown): string | null {
  return typeof v === "string" && /^\/admin\/[A-Za-z0-9\/_\-]+$/.test(v) ? v : null;
}
