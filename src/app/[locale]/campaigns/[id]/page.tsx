import { redirect } from "next/navigation";

export default async function CampaignDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  redirect(`/deals/${id}`);
}
