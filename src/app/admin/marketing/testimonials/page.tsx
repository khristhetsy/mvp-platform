import { requireRole } from "@/lib/supabase/auth";
import { listTestimonials } from "@/lib/testimonials/db";
import { MIN_FOUNDER_RESULTS } from "@/content/founder-results";
import { TestimonialsClient } from "./TestimonialsClient";

export const dynamic = "force-dynamic";

export default async function TestimonialsPage() {
  await requireRole(["admin"]);
  const rows = await listTestimonials().catch(() => []);
  return <TestimonialsClient initial={rows} minToShow={MIN_FOUNDER_RESULTS} />;
}
