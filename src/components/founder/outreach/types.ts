import type { MyContactSource } from "@/lib/founder-crm/contact-labels";

/** One row in Outreach → Manual: a founder's own investor contact. */
export type OutreachContact = {
  id: string;
  name: string;
  email: string | null;
  firm: string | null;
  investorType: string | null;
  sectors: string | null;
  source: MyContactSource;
  /** Short line under the name (firm · type), kept for older callers. */
  detail?: string | null;
};

export type RecipientStatus = {
  name: string | null;
  email: string;
  status: string;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  repliedAt: string | null;
};

export type AttachmentOptions = {
  onePager: { companyName: string; industry: string | null; fileName: string; published: boolean; url: string | null } | null;
  documents: Array<{ id: string; name: string; fileName: string | null; type: string | null; sizeBytes: number | null }>;
};
