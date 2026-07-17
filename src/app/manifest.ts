import type { MetadataRoute } from "next";

// Web app manifest — drives "Add to Home Screen" / "Install app". Chrome only offers
// installation when this advertises PNG icons at 192px and 512px (SVG does not
// qualify) AND a service worker with a fetch handler is registered (see public/sw.js).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "iCapOS",
    short_name: "iCapOS",
    description: "Capital readiness platform for founders",
    // Role-agnostic entry: the app routes founders/investors/admins to their own
    // workspace after auth. A role-specific start_url sends everyone else through a
    // redirect on launch.
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0A1A40",
    // No `orientation` lock — this installs on desktop (PC/Mac) too, where forcing
    // portrait is wrong.
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Maskable needs a filled background so Android's shape mask doesn't clip it.
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/favicon.ico", sizes: "16x16 32x32", type: "image/x-icon" },
    ],
  };
}
