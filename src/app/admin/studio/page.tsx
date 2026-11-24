import { redirect } from "next/navigation";

export default async function StudioIndexPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event } = await searchParams;
  const base = "/admin/studio/spotlight";
  redirect(event ? base + "?event=" + encodeURIComponent(event) : base);
}
