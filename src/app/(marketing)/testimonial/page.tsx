import type { Metadata } from "next";
import { verifyTestimonialToken } from "@/lib/testimonials/token";
import { loadTestimonialContext } from "@/lib/testimonials/db";
import { TestimonialForm } from "./TestimonialForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Share your iCapOS story",
  robots: { index: false, follow: false },
};

export default async function TestimonialPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const email = verifyTestimonialToken(t);

  if (!email) {
    return (
      <section className="px-6 py-24">
        <div className="mx-auto max-w-xl text-center">
          <h1 className="font-site-display text-3xl font-extrabold tracking-tight text-site-navy">This link isn&rsquo;t valid</h1>
          <p className="mt-4 text-lg leading-8 text-site-muted">Open the &ldquo;Write your recommendation&rdquo; button in your email from Khris, or reply to that email with your recommendation.</p>
        </div>
      </section>
    );
  }

  const ctx = await loadTestimonialContext(email);
  return (
    <section className="bg-site-paper px-6 py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-site-line bg-white p-6 sm:p-8">
        <TestimonialForm
          token={t!}
          firstName={ctx.firstName}
          companyName={ctx.company?.name ?? null}
          crr={ctx.crr}
          alreadyApproved={ctx.existing?.status === "approved"}
        />
      </div>
    </section>
  );
}
