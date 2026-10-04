import { SupportConfirmClient } from "./SupportConfirmClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your support request", robots: { index: false, follow: false } };

/**
 * Landing page for the "Did this solve your issue?" email buttons. The answer
 * is recorded by the page itself once it opens in a browser, not by the link
 * request, so mail scanners that pre-open links can't answer for the founder.
 */
export default async function SupportConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ a?: string }>;
}) {
  const { token } = await params;
  const { a } = await searchParams;
  return <SupportConfirmClient token={token} answer={a === "no" ? "no" : "yes"} />;
}
