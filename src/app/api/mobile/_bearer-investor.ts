// Same as withBearerFounder (see _bearer.ts), for the iCapOS app's investor workspace: signs the request in
// from the phone's Supabase access token and runs a function as that investor. Founders get 403 here, and
// investors get 403 from withBearerFounder, so the two sides never see each other's data. New file.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/supabase/types";
import { withBearerRole } from "./_bearer";

export function withBearerInvestor<T>(
  req: Request,
  fn: (ctx: { profile: Profile; email: string; client: SupabaseClient }) => Promise<T>,
) {
  return withBearerRole(req, ["investor"], fn);
}
