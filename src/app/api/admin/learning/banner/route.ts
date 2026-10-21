import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLearningStaff, jsonBadRequest } from "@/app/api/admin/learning/_shared";

const bannerSchema = z.object({
  id: z.string().uuid(),
  promo_headline: z.string().max(80).nullable().optional(),
  promo_blurb: z.string().max(200).nullable().optional(),
  promo_cta_label: z.string().max(30).nullable().optional(),
  show_in_banner: z.boolean().optional(),
  order_index: z.number().int().optional(),
});

function clean(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

/** Saves the banner copy, banner visibility and order of one course. */
export async function PATCH(request: Request) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;

  const body = await request.json().catch(() => ({}));
  const parsed = bannerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...fields } = parsed.data;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.promo_headline !== undefined) update.promo_headline = clean(fields.promo_headline);
  if (fields.promo_blurb !== undefined) update.promo_blurb = clean(fields.promo_blurb);
  if (fields.promo_cta_label !== undefined) update.promo_cta_label = clean(fields.promo_cta_label);
  if (fields.show_in_banner !== undefined) update.show_in_banner = fields.show_in_banner;
  if (fields.order_index !== undefined) update.order_index = fields.order_index;

  const { data, error } = await auth.supabase
    .from("learning_programs")
    .update(update)
    .eq("id", id)
    .select("id, promo_headline, promo_blurb, promo_cta_label, show_in_banner, order_index")
    .single();
  if (error) return jsonBadRequest(error);

  return NextResponse.json({ program: data });
}
