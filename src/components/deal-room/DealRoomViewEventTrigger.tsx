"use client";

import { useEffect } from "react";

/**
 * Fires POST /api/deal-room/[roomId]/view-event once on mount.
 * Renders nothing — purely a side-effect trigger so the Server Component
 * page doesn't perform email/notification writes during rendering.
 */
export function DealRoomViewEventTrigger({ roomId }: { roomId: string }) {
  useEffect(() => {
    void fetch(`/api/deal-room/${roomId}/view-event`, { method: "POST" });
  }, [roomId]);

  return null;
}
