import { redirect } from "next/navigation";

/**
 * The field editor moved into Registration as a tab. This URL is a year old
 * and will be in bookmarks, so it redirects rather than 404s.
 */
export default function RegistrationFieldsRedirect() {
  redirect("/admin/events/registrations?tab=fields");
}
