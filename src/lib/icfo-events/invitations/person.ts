/**
 * The person behind an invitation or a signed-in registrant: what we already
 * know (to prefill the registration) and writing their edits back.
 *
 * Prefill order, first value found wins: platform profile, Contacts record
 * (Odoo synced), then the answers from their latest registration.
 *
 * Writing back only ever happens for a person we have identified: a valid
 * invite token or a signed-in session. An email typed on the public form is
 * never used to read or change anyone's record.
 */
import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { updateContact } from "@/lib/sales/contacts";
import { mergeOverrides } from "@/lib/sales/overrides";
import { logActivity } from "@/lib/sales/activity";
import { updatePartner } from "@/lib/crm-connectors/odoo/write";
import { fetchAndMapPartner } from "@/lib/crm-connectors/odoo/adapter";
import { upsertContacts } from "@/lib/crm-connectors/mirror";
import {
  mergePrefill,
  planContactChanges,
  type ContactSnapshot,
  type FieldChange,
} from "@/lib/icfo-events/invitations/contact-sync";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

const escLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

type ContactRow = {
  id: string;
  source: string | null;
  external_id: string | null;
  name: string | null;
  email: string | null;
  company: string | null;
  phone: string | null;
  country: string | null;
  overrides: Record<string, unknown> | null;
  raw: Record<string, unknown> | null;
};

export async function findContactByEmail(email: string): Promise<ContactRow | null> {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  const { data } = await db()
    .from("crm_contacts")
    .select("id, source, external_id, name, email, company, phone, country, overrides, raw")
    .ilike("email", escLike(e))
    .order("synced_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return (data as ContactRow | null) ?? null;
}

export function snapshotOf(c: ContactRow | null): ContactSnapshot {
  const ov = c?.overrides ?? {};
  const raw = c?.raw ?? {};
  return {
    name: str(c?.name),
    company: str(c?.company),
    title: str(ov.job_position) ?? str(raw.function),
    country: str(ov.country) ?? str(c?.country),
    email: str(c?.email),
    email2: str(ov.email2),
    phone: str(c?.phone),
    phone2: str(ov.phone2) ?? str(raw.mobile),
  };
}

export type Prefill = {
  answers: Record<string, unknown>;
  from: Record<string, "profile" | "contact" | "registration">;
  /** Attendee type of their latest registration, if any. */
  lastType: string | null;
  contactId: string | null;
  firstName: string | null;
};

/** What we know about this person. Never throws. */
export async function loadPrefill(input: { email: string | null; profileId: string | null }): Promise<Prefill> {
  const empty: Prefill = { answers: {}, from: {}, lastType: null, contactId: null, firstName: null };
  try {
    let profileValues: Record<string, unknown> = {};
    let email = input.email?.trim().toLowerCase() ?? "";
    if (input.profileId) {
      const { data: p } = await db().from("profiles").select("full_name, email").eq("id", input.profileId).maybeSingle();
      if (p) {
        profileValues = { name: p.full_name ?? null, email: p.email ?? null };
        if (!email && p.email) email = String(p.email).toLowerCase();
      }
    }

    const contact = email ? await findContactByEmail(email) : null;
    const snap = snapshotOf(contact);
    const contactValues: Record<string, unknown> = {
      name: snap.name, company: snap.company, title: snap.title, country: snap.country, email: snap.email, phone: snap.phone,
    };

    // Latest registration: by account first, otherwise a guest row with this email.
    let last: { attendee_type: string | null; answers: Record<string, unknown> | null } | null = null;
    if (input.profileId) {
      const { data } = await db().from("registrations").select("attendee_type, answers")
        .eq("attendee_id", input.profileId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      last = data ?? null;
    }
    if (!last && email) {
      const { data } = await db().from("registrations").select("attendee_type, answers")
        .ilike("answers->>email", escLike(email)).order("created_at", { ascending: false }).limit(1).maybeSingle();
      last = data ?? null;
    }

    const merged = mergePrefill([
      { name: "profile", values: profileValues },
      { name: "contact", values: contactValues },
      { name: "registration", values: last?.answers ?? {} },
    ]);
    const name = typeof merged.answers.name === "string" ? merged.answers.name : null;
    return {
      ...merged,
      lastType: last?.attendee_type ?? null,
      contactId: contact?.id ?? null,
      firstName: name ? name.split(" ")[0] : null,
    };
  } catch {
    return empty;
  }
}

/** Event ids (of the given ones) this person is already registered for. */
export async function registeredEventIds(eventIds: string[], who: { email: string | null; profileId: string | null }): Promise<string[]> {
  if (!eventIds.length) return [];
  const found = new Set<string>();
  if (who.profileId) {
    const { data } = await db().from("registrations").select("event_id").in("event_id", eventIds).eq("attendee_id", who.profileId);
    for (const r of (data ?? []) as Array<{ event_id: string }>) found.add(r.event_id);
  }
  const email = who.email?.trim().toLowerCase();
  if (email) {
    const { data } = await db().from("registrations").select("event_id").in("event_id", eventIds).ilike("answers->>email", escLike(email));
    for (const r of (data ?? []) as Array<{ event_id: string }>) found.add(r.event_id);
  }
  return [...found];
}

export type SyncResult = { changes: FieldChange[]; odoo: "saved" | "skipped" | "failed" };

/**
 * Write a registrant's edits to their profile, Contacts record and Odoo, and log
 * each change on the contact timeline. Best effort: a failure here never undoes
 * the registration. `knownEmail` is the identified person's email (invite or
 * session), never the one typed on the form.
 */
export async function applyRegistrationEdits(input: {
  knownEmail: string | null;
  profileId: string | null;
  answers: Record<string, unknown>;
  eventTitle: string;
}): Promise<SyncResult> {
  const result: SyncResult = { changes: [], odoo: "skipped" };
  try {
    const contact = input.knownEmail ? await findContactByEmail(input.knownEmail) : null;

    // Profile: the account's display name.
    if (input.profileId) {
      const next = str(input.answers.name);
      const { data: p } = await db().from("profiles").select("full_name").eq("id", input.profileId).maybeSingle();
      if (next && p && (p.full_name ?? "").trim() !== next) {
        await db().from("profiles").update({ full_name: next }).eq("id", input.profileId);
        if (!contact) result.changes.push({ field: "name", label: "Full name", before: p.full_name ?? null, after: next });
      }
    }

    if (!contact) return result;
    const plan = planContactChanges(snapshotOf(contact), input.answers);
    if (!plan.changes.length) return result;

    if (Object.keys(plan.patch).length) await updateContact(contact.id, plan.patch, input.profileId);
    if (plan.email2) await mergeOverrides(contact.id, { set: { email2: plan.email2 } }, "event registration: second email");

    if (contact.source === "odoo" && contact.external_id) {
      try {
        await updatePartner(String(contact.external_id), {
          ...(plan.patch.name ? { name: plan.patch.name } : {}),
          ...(plan.patch.job_position ? { title: plan.patch.job_position } : {}),
          ...(plan.patch.phone ? { phone: plan.patch.phone } : {}),
          ...(plan.patch.phone2 ? { phone2: plan.patch.phone2 } : {}),
          ...(plan.patch.email ? { email: plan.patch.email } : {}),
        });
        const fresh = await fetchAndMapPartner(String(contact.external_id)).catch(() => null);
        if (fresh) await upsertContacts([fresh]).catch(() => {});
        result.odoo = "saved";
      } catch {
        result.odoo = "failed";
      }
    }

    await logActivity({
      kind: "contact_edit",
      actorId: input.profileId,
      contactCrmId: contact.id,
      summary: `Updated via event registration (${input.eventTitle}): ${plan.changes.map((c) => c.label).join(", ")}`,
      meta: { via: "event_registration", event: input.eventTitle, changes: plan.changes, odoo: result.odoo },
    });
    result.changes = plan.changes;
    return result;
  } catch {
    return result;
  }
}
