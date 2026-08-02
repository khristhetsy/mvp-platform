import { createServiceRoleClient } from "@/lib/supabase/admin";
import { LogoMarquee } from "@/components/marketing-site/LogoMarquee";

/**
 * Client-logo strip (spec §6, §16). Data-driven from marketing_site_logos
 * (active, ordered). Renders real logos once the table is seeded; until then it
 * shows only the heading + compliance caption — it never fabricates client
 * relationships. Logos are shown grayscale for a uniform strip; alt = the name.
 */

type Logo = { id: string; name: string; logo_url: string; sort_order: number | null };

async function loadLogos(): Promise<Logo[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createServiceRoleClient() as any;
    const { data } = await admin
      .from("marketing_site_logos")
      .select("id, name, logo_url, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    return (data ?? []) as Logo[];
  } catch {
    return [];
  }
}

export async function LogoStrip({ heading, caption }: { heading: string; caption: string }) {
  const logos = await loadLogos();
  return (
    <section className="border-b border-site-line bg-white px-6 py-12">
      <div className="mx-auto max-w-6xl text-center">
        <p className="font-site-mono text-xs uppercase tracking-wider text-site-muted">{heading}</p>
        {logos.length > 0 ? <LogoMarquee logos={logos} /> : null}
        <p className="mx-auto mt-4 max-w-3xl text-[11px] leading-5 text-site-muted/80">{caption}</p>
      </div>
    </section>
  );
}
