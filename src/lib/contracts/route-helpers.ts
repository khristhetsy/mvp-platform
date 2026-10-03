// Shared guards for the contract route handlers.

import "server-only";
import { canSeeDocument, forbidden, notFound, requireContractsApi, type ContractsActor } from "./access";
import { expireIfDue, loadBundle, type Bundle } from "./service";

/** Authenticated actor plus a document they are allowed to see. */
export async function actorAndBundle(id: string): Promise<{ actor: ContractsActor; b: Bundle } | { error: Response }> {
  const auth = await requireContractsApi();
  if ("error" in auth) return auth;
  const b = await loadBundle(auth.actor.db, id);
  if (!b) return { error: notFound("Document not found.") };
  if (!(await canSeeDocument(auth.actor, b.doc))) return { error: forbidden() };
  b.doc = await expireIfDue(auth.actor.db, b.doc);
  return { actor: auth.actor, b };
}

export function pdfResponse(bytes: Buffer, filename: string, download: boolean): Response {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
