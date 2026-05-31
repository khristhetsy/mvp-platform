import type { ImportType } from "@/lib/imports/types";
import { normalizeDomain } from "@/lib/imports/validators";

export type ImportContextIndex = {
  founderEmails: Map<string, string>;
  founderCompanyKeys: Set<string>;
  companyByDomain: Map<string, string>;
  companyByNameFounder: Map<string, string>;
  investorByEmail: Map<string, { profileId: string; investorProfileId: string }>;
  investorByFirmName: Map<string, string>;
  founderContactKeys: Map<string, string>;
  entityKeys: Set<string>;
};

export type ExistingMatch = {
  entityType: string;
  entityId: string;
  actionHint: "skip or update";
};

export function buildDuplicateKey(
  importType: ImportType,
  mapped: Record<string, string>,
  context: ImportContextIndex,
): string | undefined {
  switch (importType) {
    case "companies": {
      const domain = normalizeDomain(mapped.website ?? "");
      const founderEmail = mapped.founder_email?.trim().toLowerCase();
      const name = mapped.company_name?.trim().toLowerCase();
      if (domain) return `company:domain:${domain}`;
      if (founderEmail && name) return `company:name:${founderEmail}::${name}`;
      return undefined;
    }
    case "investors": {
      const email = mapped.email?.trim().toLowerCase();
      if (email) return `investor:email:${email}`;
      const firm = mapped.firm_name?.trim().toLowerCase();
      const name = mapped.full_name?.trim().toLowerCase();
      if (firm && name) return `investor:firm:${firm}::${name}`;
      return undefined;
    }
    case "founder_contacts":
    case "outreach_contacts": {
      const founderEmail = mapped.founder_email?.trim().toLowerCase();
      const companyName = mapped.company_name?.trim().toLowerCase();
      const email = mapped.email?.trim().toLowerCase();
      const investorName = mapped.investor_name?.trim().toLowerCase();
      if (founderEmail && companyName && (email || investorName)) {
        return `contact:${founderEmail}::${companyName}::${email ?? investorName}`;
      }
      return undefined;
    }
    case "social_links":
    case "crm_notes_tags": {
      const entityType = mapped.entity_type?.trim().toLowerCase();
      const identifier = mapped.entity_email_or_name?.trim().toLowerCase();
      if (entityType && identifier) return `${entityType}:${identifier}`;
      return undefined;
    }
    default:
      return undefined;
  }
}

export function findExistingMatch(
  importType: ImportType,
  mapped: Record<string, string>,
  context: ImportContextIndex,
): ExistingMatch | null {
  switch (importType) {
    case "companies": {
      const domain = normalizeDomain(mapped.website ?? "");
      if (domain && context.companyByDomain.has(domain)) {
        return { entityType: "company", entityId: context.companyByDomain.get(domain)!, actionHint: "skip or update" };
      }
      const founderEmail = mapped.founder_email?.trim().toLowerCase();
      const founderId = founderEmail ? context.founderEmails.get(founderEmail) : undefined;
      const name = mapped.company_name?.trim().toLowerCase();
      if (founderId && name) {
        const id = context.companyByNameFounder.get(`${name}::${founderId}`);
        if (id) return { entityType: "company", entityId: id, actionHint: "skip or update" };
      }
      return null;
    }
    case "investors": {
      const email = mapped.email?.trim().toLowerCase();
      if (email && context.investorByEmail.has(email)) {
        const match = context.investorByEmail.get(email)!;
        return { entityType: "investor_profile", entityId: match.investorProfileId, actionHint: "skip or update" };
      }
      const firm = mapped.firm_name?.trim().toLowerCase();
      const name = mapped.full_name?.trim().toLowerCase();
      if (firm && name && context.investorByFirmName.has(`${firm}::${name}`)) {
        return {
          entityType: "investor_profile",
          entityId: context.investorByFirmName.get(`${firm}::${name}`)!,
          actionHint: "skip or update",
        };
      }
      return null;
    }
    case "founder_contacts":
    case "outreach_contacts": {
      const founderEmail = mapped.founder_email?.trim().toLowerCase();
      const companyName = mapped.company_name?.trim().toLowerCase();
      const email = mapped.email?.trim().toLowerCase();
      const investorName = mapped.investor_name?.trim().toLowerCase();
      if (!founderEmail || !companyName) return null;
      const founderId = context.founderEmails.get(founderEmail);
      if (!founderId) return null;
      const companyId = [...context.companyByNameFounder.entries()].find(
        ([key]) => key.startsWith(`${companyName}::`),
      )?.[1];
      if (!companyId) return null;
      const key = `${founderId}::${companyId}::${email ?? investorName ?? ""}`;
      const contactId = context.founderContactKeys.get(key);
      if (contactId) {
        return { entityType: "founder_investor_contact", entityId: contactId, actionHint: "skip or update" };
      }
      return null;
    }
    default:
      return null;
  }
}

export function resolveFounderCompanyIds(
  mapped: Record<string, string>,
  context: ImportContextIndex,
): { founderId: string; companyId: string } | null {
  const founderEmail = mapped.founder_email?.trim().toLowerCase();
  const companyName = mapped.company_name?.trim().toLowerCase();
  if (!founderEmail || !companyName) return null;
  const founderId = context.founderEmails.get(founderEmail);
  if (!founderId) return null;
  const companyId = context.companyByNameFounder.get(`${companyName}::${founderId}`);
  if (!companyId) return null;
  return { founderId, companyId };
}
