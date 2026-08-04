import { redirect } from "next/navigation";

// The standalone Matching Center has been superseded by the Deploy workspace,
// which shows ranked investor matches alongside automated + manual outreach in
// one place. Redirect any hit on the old route so links, bookmarks, and stale
// nav entries all land on the current experience. (Reversible: restore the prior
// page from git history if the Matching Center is ever needed on its own again.)
export default function FounderMatchingRedirect() {
  redirect("/founder/deploy");
}
