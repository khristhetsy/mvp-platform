import { notFound } from "next/navigation";
import { inviteFromToken, getMaterials, stageLink } from "@/lib/icfo-events/invites";
import { INVITE_ROLES } from "@/lib/icfo-events/invite-rules";
import { ExhibitorInviteClient } from "./ExhibitorInviteClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your invitation" };

/**
 * The tokenless invitation page.
 *
 * This is the exhibitor path: a booth is bought by a company, not by a member,
 * so there is usually no iCapOS account to sign into. Possession of the emailed
 * link is the authorization — verified against the row's stored nonce, so a
 * revoked link stops working even though its signature is intact.
 *
 * Founders and showcase presenters have accounts and answer in their portal;
 * if one of them opens this link, the client sends them there.
 */
export default async function EventInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await inviteFromToken(token);
  if (!invite) notFound();

  const spec = INVITE_ROLES[invite.role];
  const materials = invite.presenterId ? await getMaterials(invite.presenterId) : null;
  const link = invite.status === "accepted" ? await stageLink(invite.sessionId) : null;

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <ExhibitorInviteClient
        token={token}
        invite={{
          id: invite.id,
          role: invite.role,
          roleLabel: spec.label,
          status: invite.status,
          note: invite.note,
          materialsDue: invite.materialsDue,
          eventTitle: invite.eventTitle ?? "an iCFO event",
          displayName: invite.displayName,
        }}
        wants={{ video: spec.wantsVideo, deck: spec.wantsDeck }}
        materials={materials}
        stage={link}
        portalPath={spec.respondsInPortal ? "/founder/events/present" : null}
      />
    </main>
  );
}
