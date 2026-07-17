import type { Metadata } from "next";
import { InstallClient } from "./InstallClient";

export const metadata: Metadata = {
  title: "Install iCapOS on your device",
  description: "Add iCapOS to your phone or computer in three taps. No app store, nothing to download.",
  openGraph: {
    title: "Install iCapOS",
    description: "Add iCapOS to your phone or computer in three taps.",
  },
};

// Public install guide — device-aware steps plus a one-tap install where the browser
// supports it. Installability itself comes from the manifest (src/app/manifest.ts) and
// the service worker (public/sw.js).
export default function InstallPage() {
  return <InstallClient />;
}
