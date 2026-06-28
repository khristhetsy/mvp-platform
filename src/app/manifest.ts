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
      { src: "/icapos-icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
      { src: "/icapos-icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
      { src: "/favicon.ico", sizes: "16x16 32x32", type: "image/x-icon" },
    ],
  };
}
