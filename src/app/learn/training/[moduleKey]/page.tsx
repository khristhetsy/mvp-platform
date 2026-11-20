import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Old class links open the Training course, which now lives in Learning. */
export default function TrainingClassRedirect() {
  redirect("/learn/training");
}
