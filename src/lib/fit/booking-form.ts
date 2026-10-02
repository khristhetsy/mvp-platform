import { createServiceRoleClient } from "@/lib/supabase/admin";
import { FIT_BOOKING_FORM_DEFAULTS, resolveFitBookingForm, type FitBookingForm } from "@/lib/fit/booking-form-config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

/** The saved /fit booking form, or the defaults when none is saved (or the table is missing). */
export async function getFitBookingForm(): Promise<FitBookingForm> {
  try {
    const { data } = await db().from("fit_settings").select("booking_form").eq("id", "default").maybeSingle();
    return data?.booking_form ? resolveFitBookingForm(data.booking_form) : FIT_BOOKING_FORM_DEFAULTS;
  } catch {
    return FIT_BOOKING_FORM_DEFAULTS;
  }
}

/** Sanitise and save. Returns what was stored. */
export async function saveFitBookingForm(input: unknown): Promise<FitBookingForm> {
  const form = resolveFitBookingForm(input);
  const { error } = await db().from("fit_settings").upsert(
    { id: "default", booking_form: form, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
  return form;
}
