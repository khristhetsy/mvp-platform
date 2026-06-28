import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "iCapOS",
    short_name: "iCapOS",
    description: "Capital readiness platform for founders",
    start_url: "/founder/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    orientation: "portrait",
    icons: [
      { src: "/capitalos-icon.png", sizes: "192x192", type: "image/png" },
      { src: "/capitalos-icon.png", sizes: "512x512", type: "image/png" },
      { src: "/capitalos-icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
