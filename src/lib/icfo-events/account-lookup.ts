/**
 * Does this email already belong to an iCapOS account?
 *
 * Event registration asks this so a person with an account signs in and
 * registers with their login, instead of becoming a guest row that nothing
 * else can reach.
 */
import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { maskEmail } from "@/lib/icfo-events/mask-email";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** ilike treats % _ and \ as wildcards; an email must match literally. */
const literal = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function findAccountByEmail(email: string): Promise<{ profileId: string; masked: string } | null> {
  const clean = email.trim().toLowerCase();
  if (!EMAIL.test(clean)) return null;
  const { data } = await createServiceRoleClient()
    .from("profiles")
    .select("id")
    .ilike("email", literal(clean))
    .limit(1)
    .maybeSingle();
  if (!data?.id) return null;
  return { profileId: String(data.id), masked: maskEmail(clean) };
}
