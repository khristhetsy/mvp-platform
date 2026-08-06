"use client";

import { useEventPresence } from "@/components/events/EventPresenceProvider";

/** Live popup shown to an attendee when a connection starts a 1:1 video call.
 *  Google Meet can't embed, so joining opens the Meet in a new tab. */
export function IncomingCallBanner() {
  const { incomingCall, dismissCall } = useEventPresence();
  if (!incomingCall) return null;

  return (
    <div
      role="dialog"
      aria-label="Incoming video call"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(4,12,28,.55)" }}
      onClick={dismissCall}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium"
          style={{ background: "#E1F5EE", color: "#0F6E56" }}
        >
          <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "#1D9E75" }} aria-hidden />
          INCOMING VIDEO CALL
        </span>
        <p className="mt-3.5 text-lg font-medium" style={{ color: "#0c2340" }}>{incomingCall.fromName} is calling</p>
        <p className="mt-1 text-sm" style={{ color: "#5b6470" }}>They&rsquo;d like to connect over Google Meet.</p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => {
              window.open(incomingCall.meetUrl, "_blank", "noopener");
              dismissCall();
            }}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white"
            style={{ background: "#1D9E75" }}
          >
            Join call ↗
          </button>
          <button
            onClick={dismissCall}
            className="w-full rounded-lg border px-4 py-2 text-sm"
            style={{ borderColor: "#d8dce1", color: "#5b6470" }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
