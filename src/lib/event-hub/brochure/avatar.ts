// Presenter avatar selection, shared by the HTML preview, the PDF, and preflight.
// Order: headshot, then company logo, then initials.

export type AvatarSource =
  | { kind: "headshot"; url: string }
  | { kind: "logo"; url: string }
  | { kind: "initials" };

export function avatarSource(p: { headshotUrl: string | null; companyLogoUrl?: string | null }): AvatarSource {
  if (p.headshotUrl) return { kind: "headshot", url: p.headshotUrl };
  if (p.companyLogoUrl) return { kind: "logo", url: p.companyLogoUrl };
  return { kind: "initials" };
}
