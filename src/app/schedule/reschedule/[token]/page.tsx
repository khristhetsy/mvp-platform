import { verifyBookingToken } from "@/lib/scheduling/tokens";
import { getBooking } from "@/lib/scheduling/bookings";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadAvailability } from "@/lib/scheduling/store";
import { BookingClient } from "@/components/calendar/BookingClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reschedule booking" };

type Props = { params: Promise<{ token: string }> };

export default async function ReschedulePage({ params }: Props) {
  const { token } = await params;
  const bookingId = verifyBookingToken(token, "reschedule");
  if (!bookingId) {
    return <div className="mx-auto max-w-md px-4 py-16"><div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><p className="text-sm text-slate-700">This reschedule link is invalid or has expired.</p></div></div>;
  }
  const booking = await getBooking(bookingId);
  if (!booking || !booking.host_id) {
    return <div className="mx-auto max-w-md px-4 py-16"><div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><p className="text-sm text-slate-700">We couldn&apos;t find that booking.</p></div></div>;
  }

  const admin = createServiceRoleClient();
  const { data } = await admin.from("profiles").select("full_name, email").eq("id", booking.host_id).single();
  const host = data as { full_name: string | null; email: string | null } | null;
  const hostName = host?.full_name ?? host?.email ?? "this member";
  const availability = await loadAvailability(admin, booking.host_id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mx-auto mb-4 max-w-2xl rounded-lg border border-[#F4D9A0] bg-[#FAEEDA] px-4 py-2.5 text-sm text-[#854F0B]">
        Rescheduling your booking — pick a new time below. Your previous slot is released once the new time is confirmed.
      </div>
      <BookingClient
        hostId={booking.host_id}
        hostName={hostName}
        meetingTitle={availability.meetingTitle}
        slotDurations={availability.slotDurations}
        questions={availability.questions}
        contactFields={availability.contactFields}
        viewerName={booking.booker_name}
        viewerEmail={booking.booker_email}
        rescheduleToken={token}
      />
    </div>
  );
}
