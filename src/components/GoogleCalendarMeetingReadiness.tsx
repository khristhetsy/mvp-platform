export function GoogleCalendarMeetingReadiness({
  googleCalendarReady,
}: Readonly<{ googleCalendarReady: boolean }>) {
  if (googleCalendarReady) {
    return (
      <p className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
        Google Calendar ready — when you accept a meeting, your connected account will host the Calendar event and
        Meet link.
      </p>
    );
  }

  return (
    <p className="mt-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      Connect a Google account in Settings to enable Calendar scheduling later. The person who accepts a meeting
      will host the calendar event.
    </p>
  );
}
