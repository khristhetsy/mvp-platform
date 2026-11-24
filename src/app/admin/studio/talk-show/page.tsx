import { StudioRoomPage } from "@/components/admin-events/StudioRoomPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Talk Show Studio" };

export default function Page({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  return <StudioRoomPage room="talk-show" searchParams={searchParams} />;
}
