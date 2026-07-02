import type { Channel } from "./catalog";

export interface NotifSettings {
  admin_id: string;
  master_on: boolean;
  quiet_hours_on: boolean;
  quiet_start: string; // "HH:MM"
  quiet_end: string;
  digest_time: string;
  default_channels: Channel[];
  timezone: string;
}

export interface NotifPref {
  type_id: string;
  enabled: boolean;
  channels: Channel[];
  cadence: string | null;
}

export interface FeedItem {
  id: string;
  type_id: string;
  title: string;
  body: string;
  link: string | null;
  meta: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export const DEFAULT_SETTINGS: Omit<NotifSettings, "admin_id"> = {
  master_on: true,
  quiet_hours_on: true,
  quiet_start: "21:00",
  quiet_end: "07:00",
  digest_time: "06:30",
  default_channels: ["in_app", "email"],
  timezone: "Europe/Paris",
};
