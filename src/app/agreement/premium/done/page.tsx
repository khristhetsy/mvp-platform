import type { Metadata } from "next";

export const metadata: Metadata = { title: "Premium activated | iCapOS", robots: { index: false, follow: false } };

export default function PremiumDonePage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Thank you</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Your payment is being confirmed. iCFO will be in touch to start your Premium services. A copy of your Services Agreement was emailed to you.</p>
    </main>
  );
}
