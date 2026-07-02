import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { AeoPageBody } from "@/components/aeo/AeoPageBody";
import { getPublishedBySlug, listPublishedSlugs } from "@/lib/aeo/store";
import { buildJsonLd } from "@/lib/aeo/schema";

// SSG + ISR: statically rendered, revalidated on publish (via revalidatePath) and
// hourly as a backstop. New published slugs render on first request.
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await listPublishedSlugs();
  return slugs.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedBySlug(slug);
  if (!page) return { title: "Not found" };
  const description = page.metaDescription || page.lede;
  return {
    title: `${page.h1} · iCapOS`,
    description,
    alternates: { canonical: `/learn/${page.slug}` },
    openGraph: { title: page.h1, description, url: `/learn/${page.slug}`, type: "article" },
    twitter: { card: "summary_large_image", title: page.h1, description },
  };
}

export default async function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublishedBySlug(slug);
  if (!page) notFound();

  return (
    <main>
      <JsonLd data={buildJsonLd(page)} />
      <AeoPageBody page={page} />
    </main>
  );
}
