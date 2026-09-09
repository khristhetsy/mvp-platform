import { verifyBookingToken } from "@/lib/scheduling/tokens";
import { getBooking } from "@/lib/scheduling/bookings";
import { CancelConfirm } from "./CancelConfirm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cancel booking" };

type Props = { params: Promise<{ token: string }> };

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md px-4 py-16">{children}</div>;
}

export default async function CancelBookingPage({ params }: Props) {
  const { token } = await params;
  const bookingId = verifyBookingToken(token, "cancel");
  if (!bookingId) {
    return <Shell><div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><p className="text-sm text-slate-700">This cancellation link is invalid or has expired.</p></div></Shell>;
  }
  const booking = await getBooking(bookingId);
  if (!booking) {
    return <Shell><div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><p className="text-sm text-slate-700">We couldn&apos;t find that booking.</p></div></Shell>;
  }

  const when = (() => {
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: booking.timezone ?? "UTC", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(booking.start_time));
    } catch { return new Date(booking.start_time).toUTCString(); }
  })();

  return (
    <Shell>
      <CancelConfirm
        token={token}
        alreadyCancelled={booking.status === "cancelled"}
        title={booking.event_type ?? "Meeting"}
        hostName={booking.host_name ?? null}
        when={when}
      />
    </Shell>
  );
}
