import { founderResults } from "@/content/founder-results";
import { loadApprovedFounderResults } from "@/lib/testimonials/db";
import { FounderResults } from "./FounderResults";

/** Homepage wrapper: entries from the content file plus testimonials approved in Marketing Hub. */
export async function FounderResultsSection() {
  const approved = await loadApprovedFounderResults();
  return <FounderResults results={[...founderResults, ...approved]} />;
}
