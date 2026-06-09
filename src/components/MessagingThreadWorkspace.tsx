"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { GoogleCalendarMeetingReadiness } from "@/components/GoogleCalendarMeetingReadiness";
import type { MessageThreadDetail, MessageThreadListItem } from "@/lib/messaging/types";

type WorkspaceRole = "founder" | "investor";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "active":
    case "accepted":
    case "scheduled":
      return "bg-emerald-50 text-emerald-800";
    case "requested":
    case "proposed":
      return "bg-amber-50 text-amber-900";
    case "declined":
    case "canceled":
    case "closed":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-indigo-50 text-indigo-800";
  }
}

function messageTypeLabel(type: string) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function MessagingThreadWorkspace({
  role,
  basePath,
  threads,
  selectedThreadId,
  detail,
  currentUserId,
  googleCalendarReady,
}: Readonly<{
  role: WorkspaceRole;
  basePath: string;
  threads: MessageThreadListItem[];
  selectedThreadId: string | null;
  detail: MessageThreadDetail | null;
  currentUserId: string;
  googleCalendarReady: boolean;
}>) {
  const router = useRouter();
  const [messageBody, setMessageBody] = useState("");
  const [meetingStart, setMeetingStart] = useState("");
  const [meetingEnd, setMeetingEnd] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counterpartyLabel = useMemo(() => {
    if (!detail) {
      return null;
    }
    return role === "founder" ? detail.investor_name : detail.company_name;
  }, [detail, role]);

  const latestMeeting = detail?.meetings[0] ?? null;

  async function sendMessage() {
    if (!selectedThreadId || !messageBody.trim()) {
      return;
    }

    setLoading("message");
    setError(null);

    const response = await fetch(`/api/messaging/threads/${selectedThreadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: messageBody.trim() }),
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setLoading(null);

    if (!response.ok) {
      setError(body?.error ?? "Unable to send message.");
      return;
    }

    setMessageBody("");
    router.refresh();
  }

  async function requestMeeting() {
    if (!selectedThreadId) {
      return;
    }

    setLoading("meeting");
    setError(null);

    const payload: Record<string, string> = { timezone: "UTC" };
    if (meetingStart) {
      payload.proposedStartTime = new Date(meetingStart).toISOString();
    }
    if (meetingEnd) {
      payload.proposedEndTime = new Date(meetingEnd).toISOString();
    }
    if (meetingNotes.trim()) {
      payload.meetingNotes = meetingNotes.trim();
    }

    const response = await fetch(`/api/messaging/threads/${selectedThreadId}/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setLoading(null);

    if (!response.ok) {
      setError(body?.error ?? "Unable to request meeting.");
      return;
    }

    setMeetingStart("");
    setMeetingEnd("");
    setMeetingNotes("");
    router.refresh();
  }

  async function updateMeeting(action: "accept" | "decline" | "cancel" | "propose") {
    if (!latestMeeting) {
      return;
    }

    setLoading(action);
    setError(null);

    const payload: Record<string, string> = { action };
    if (action === "propose") {
      if (meetingStart) {
        payload.proposedStartTime = new Date(meetingStart).toISOString();
      }
      if (meetingEnd) {
        payload.proposedEndTime = new Date(meetingEnd).toISOString();
      }
      payload.timezone = "UTC";
      if (meetingNotes.trim()) {
        payload.meetingNotes = meetingNotes.trim();
      }
    }

    const response = await fetch(`/api/messaging/meetings/${latestMeeting.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setLoading(null);

    if (!response.ok) {
      setError(body?.error ?? "Unable to update meeting.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(260px,320px)_1fr]">
      <aside aria-label="Message threads" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-950">Inbox</p>
          <p className="text-xs text-slate-500">{threads.length} threads</p>
        </div>
        {threads.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-600">
            No conversations yet. Threads open when an investor requests an intro or follow-up.
          </p>
        ) : (
          <nav aria-label="Message threads">
          <ul className="divide-y divide-slate-100">
            {threads.map((thread) => {
              const label =
                role === "founder" ? thread.investor_name : thread.company_name;
              const active = thread.id === selectedThreadId;

              return (
                <li key={thread.id}>
                  <Link
                    href={`${basePath}/${thread.id}`}
                    aria-current={active ? "page" : undefined}
                    className={`block px-4 py-3 transition hover:bg-indigo-50/60 ${
                      active ? "bg-indigo-50/80" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-900">{label ?? "Conversation"}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadgeClass(thread.status)}`}
                      >
                        {thread.status}
                      </span>
                    </div>
                    {thread.last_message_preview ? (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{thread.last_message_preview}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-slate-500">
                      {thread.last_message_at ? formatDate(thread.last_message_at) : ""}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
          </nav>
        )}
      </aside>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {!detail ? (
          <div className="px-6 py-16 text-center text-sm text-slate-600">
            Select a thread to view messages and meeting requests.
          </div>
        ) : (
          <>
            <div className="border-b border-slate-100 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-950">{counterpartyLabel ?? "Thread"}</h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${statusBadgeClass(detail.thread.status)}`}
                >
                  {detail.thread.status}
                </span>
                {latestMeeting ? (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${statusBadgeClass(latestMeeting.status)}`}
                  >
                    Meeting: {latestMeeting.status}
                  </span>
                ) : null}
              </div>
              {detail.intro_request_message ? (
                <p className="mt-2 text-sm text-slate-600">
                  Intro context: {detail.intro_request_message}
                </p>
              ) : null}
            </div>

            <div className="max-h-[420px] space-y-3 overflow-y-auto px-6 py-4">
              {detail.messages.map((message) => {
                const isSelf = message.sender_id === currentUserId;
                const isSystem = message.message_type !== "user_message";

                return (
                  <div
                    key={message.id}
                    className={`rounded-xl px-4 py-3 text-sm ${
                      isSystem
                        ? "border border-slate-100 bg-slate-50 text-slate-700"
                        : isSelf
                          ? "ml-8 bg-indigo-600 text-white"
                          : "mr-8 bg-slate-100 text-slate-900"
                    }`}
                  >
                    {isSystem ? (
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        {messageTypeLabel(message.message_type)}
                      </p>
                    ) : null}
                    <p className="whitespace-pre-wrap">{message.body}</p>
                    <p className={`mt-1 text-[11px] ${isSelf && !isSystem ? "text-indigo-100" : "text-slate-500"}`}>
                      {formatDate(message.created_at)}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-100 px-6 py-4">
              <label htmlFor="message-body" className="text-sm font-medium text-slate-800">Send message</label>
              <textarea
                id="message-body"
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                rows={3}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Write a professional message…"
              />
              <button
                type="button"
                disabled={loading === "message" || !messageBody.trim()}
                onClick={() => void sendMessage()}
                className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading === "message" ? "Sending…" : "Send"}
              </button>
            </div>

            <div className="border-t border-slate-100 px-6 py-4">
              <p className="text-sm font-semibold text-slate-950">Meeting</p>
              <GoogleCalendarMeetingReadiness googleCalendarReady={googleCalendarReady} />

              {latestMeeting?.status === "scheduled" && latestMeeting.external_meet_url ? (
                <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  Google Meet:{" "}
                  <a
                    href={latestMeeting.external_meet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline"
                  >
                    Join meeting
                  </a>
                </p>
              ) : null}
              {latestMeeting?.status === "accepted" ? (
                <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Meeting accepted. Connect Google to create Calendar/Meet event.
                </p>
              ) : null}

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  type="datetime-local"
                  value={meetingStart}
                  onChange={(event) => setMeetingStart(event.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  aria-label="Proposed start time"
                />
                <input
                  type="datetime-local"
                  value={meetingEnd}
                  onChange={(event) => setMeetingEnd(event.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  aria-label="Proposed end time"
                />
              </div>
              <textarea
                aria-label="Meeting notes (optional)"
                value={meetingNotes}
                onChange={(event) => setMeetingNotes(event.target.value)}
                rows={2}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Meeting notes (optional)"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={Boolean(loading)}
                  onClick={() => void requestMeeting()}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800"
                >
                  Request Meeting
                </button>
                <button
                  type="button"
                  disabled={Boolean(loading)}
                  onClick={() => void updateMeeting("propose")}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800"
                >
                  Propose Time
                </button>
                {latestMeeting && ["proposed", "accepted"].includes(latestMeeting.status) ? (
                  <>
                    <button
                      type="button"
                      disabled={Boolean(loading)}
                      onClick={() => void updateMeeting("accept")}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Accept Meeting
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(loading)}
                      onClick={() => void updateMeeting("decline")}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-800"
                    >
                      Decline Meeting
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(loading)}
                      onClick={() => void updateMeeting("cancel")}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                    >
                      Cancel Meeting
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            {error ? <p className="px-6 pb-4 text-sm text-red-700">{error}</p> : null}
          </>
        )}
      </section>
    </div>
  );
}
