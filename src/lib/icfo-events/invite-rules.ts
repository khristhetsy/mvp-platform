/**
 * Pure rules for presenter invitations — no database, no network, so the parts
 * most likely to be wrong are the parts that can be tested directly.
 */

/** The three things you can be invited as. Mirrors speaker_application_kind. */
export type InviteRole = "presenter" | "founder_showcase" | "exhibitor";

export type RoleSpec = {
  role: InviteRole;
  label: string;
  blurb: string;
  /** Materials this role is asked for. */
  wantsVideo: boolean;
  wantsDeck: boolean;
  /**
   * Founders and showcase presenters have iCapOS accounts, so their invitation
   * belongs in the portal. An exhibitor usually has no account at all — a booth
   * is bought by a company, not by a member — so they respond on a signed link
   * and never sign in.
   */
  respondsInPortal: boolean;
};

export const INVITE_ROLES: Record<InviteRole, RoleSpec> = {
  presenter: {
    role: "presenter",
    label: "Founder",
    blurb: "Speaks on a panel or gives a talk. Not pitching.",
    wantsVideo: false,
    wantsDeck: false,
    respondsInPortal: true,
  },
  founder_showcase: {
    role: "founder_showcase",
    label: "Founder Showcase",
    blurb: "Pitches from the main stage in a showcase slot.",
    wantsVideo: true,
    wantsDeck: true,
    respondsInPortal: true,
  },
  exhibitor: {
    role: "exhibitor",
    label: "Exhibitor",
    blurb: "Runs a booth in the expo hall, no stage slot.",
    wantsVideo: false,
    wantsDeck: true,
    respondsInPortal: false,
  },
};

export const INVITE_ROLE_VALUES = Object.keys(INVITE_ROLES) as InviteRole[];

export function isInviteRole(v: unknown): v is InviteRole {
  return typeof v === "string" && v in INVITE_ROLES;
}

/**
 * Where an invitee responds. An account is what decides it, not just the role:
 * a founder invited as an exhibitor still has a portal to answer in, and
 * sending them a tokenless link would be odd.
 */
export function respondPath(role: InviteRole, hasAccount: boolean, token: string): string {
  return hasAccount && INVITE_ROLES[role].respondsInPortal
    ? "/founder/events/present"
    : `/e/invite/${token}`;
}

// ── Pitch video ──────────────────────────────────────────────────────────────

/**
 * Hosts we accept a pitch video from. Nothing here hosts video — a pitch
 * recording is far larger than the 25MB document ceiling — so the field takes a
 * link and the allowlist keeps it to somewhere that actually plays.
 */
const VIDEO_HOSTS = [
  "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
  "vimeo.com", "www.vimeo.com", "player.vimeo.com",
  "loom.com", "www.loom.com",
];

export type UrlCheck = { ok: true; url: string } | { ok: false; message: string };

/** Looks like a filename someone tried to paste instead of a link. */
const FILE_LIKE = /\.(mp4|mov|avi|wmv|mkv|webm|m4v|ppt|pptx|key|pdf)$/i;

export function validateVideoUrl(raw: string): UrlCheck {
  const value = raw.trim();
  if (!value) return { ok: false, message: "Add a link to your pitch video." };

  if (FILE_LIKE.test(value) && !value.includes("://")) {
    return {
      ok: false,
      message: "That looks like a file. Upload it to YouTube, Vimeo or Loom and paste the link here instead.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    return { ok: false, message: "That isn't a valid link. Paste the full URL, starting with https://" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, message: "Links must start with https://" };
  }

  const host = parsed.hostname.toLowerCase();
  if (!VIDEO_HOSTS.includes(host)) {
    return {
      ok: false,
      message: "We accept YouTube, Vimeo and Loom links. Upload your video to one of those and paste the share link.",
    };
  }

  // A bare host with no path is the channel, not the video.
  if (parsed.pathname === "/" && !parsed.searchParams.get("v")) {
    return { ok: false, message: "That's the site, not a video. Paste the link to the video itself." };
  }

  return { ok: true, url: parsed.toString() };
}

// ── Materials completeness ───────────────────────────────────────────────────

export type Materials = { videoUrl: string | null; deckPath: string | null };

/**
 * What is still outstanding for this role. Only what the role is actually asked
 * for counts — chasing an exhibitor for a pitch video they were never asked for
 * is how a reminder loses its credibility.
 */
export function outstandingMaterials(role: InviteRole, m: Materials): string[] {
  const spec = INVITE_ROLES[role];
  const missing: string[] = [];
  if (spec.wantsVideo && !m.videoUrl) missing.push("Pitch video");
  if (spec.wantsDeck && !m.deckPath) missing.push("Pitch deck");
  return missing;
}

export function materialsComplete(role: InviteRole, m: Materials): boolean {
  return outstandingMaterials(role, m).length === 0;
}
