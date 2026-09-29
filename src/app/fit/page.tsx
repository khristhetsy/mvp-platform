import type { Metadata } from "next";
import { FitFunnelClient } from "./FitFunnelClient";

export const metadata: Metadata = {
  title: "Find investors that fit your raise — iCapOS",
  description: "Answer five questions and see the investors in our network that match your raise.",
  robots: { index: false, follow: false },
};

// Public capital funnel (build-spec §6). No auth, no pricing, no email before the
// match screen. The email IS the landing page in production; standalone it opens on Q1.
export default function FitPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-16">
      <FitFunnelClient />
    </main>
  );
}
