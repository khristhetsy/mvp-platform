// Manager acceptance of a subscription package. Pure (unit tested in
// acceptance.test.ts); the database side is acceptance-server.ts.
//
// The subscriber signs the Signature Pages on a signing link, iCFO countersigns
// the pages it signs (the Subscription Agreement signature page), then the
// Manager accepts the subscription. Acceptance only records the decision and
// tells the subscriber to follow the Subscription Instructions. Nothing here
// holds, moves or confirms money: funding happens outside the platform.

import type { ContractStatus } from "../types";

export type AcceptanceDoc = { id: string; name: string; partKey: string | null; delivery: "sign" | "review"; status: ContractStatus };

export type AcceptanceStep = { key: "subscriber_signs" | "manager_countersigns" | "manager_accepts"; label: string; detail: string; done: boolean };

export type AcceptanceState = {
  steps: AcceptanceStep[];
  /** Index of the step waiting on someone, or -1 when everything is done. */
  current: number;
  canAccept: boolean;
  /** Why acceptance is not open yet, in words for the sender. */
  blocker: string | null;
};

const SUBSCRIBER_SIGNED: ContractStatus[] = ["awaiting_countersign", "signed"];
const STOPPED: ContractStatus[] = ["declined", "changes_requested", "cancelled", "expired"];

export function acceptanceState(docs: AcceptanceDoc[], acceptedAt: string | null): AcceptanceState {
  const signing = docs.filter((d) => d.delivery === "sign");
  const signedBySubscriber = signing.filter((d) => SUBSCRIBER_SIGNED.includes(d.status)).length;
  const awaitingCountersign = signing.filter((d) => d.status === "awaiting_countersign").length;
  const stopped = signing.filter((d) => STOPPED.includes(d.status));
  const allSigned = signing.length > 0 && signedBySubscriber === signing.length;
  const executed = allSigned && awaitingCountersign === 0;

  const steps: AcceptanceStep[] = [
    {
      key: "subscriber_signs",
      label: "Subscriber signs the Signature Pages",
      detail: signing.length ? `${signedBySubscriber} of ${signing.length} signed` : "No signature pages in this package",
      done: allSigned,
    },
    {
      key: "manager_countersigns",
      label: "Manager countersigns",
      detail: !allSigned ? "After the subscriber signs" : awaitingCountersign ? `${awaitingCountersign} waiting for your countersignature` : "Countersigned",
      done: executed,
    },
    {
      key: "manager_accepts",
      label: "Manager accepts the subscription",
      detail: acceptedAt ? `Accepted ${new Date(acceptedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "Records acceptance and tells the subscriber to follow the Subscription Instructions",
      done: Boolean(acceptedAt),
    },
  ];
  const current = steps.findIndex((s) => !s.done);
  const blocker = acceptedAt
    ? null
    : stopped.length
      ? `${stopped[0].name} was ${stopped[0].status === "changes_requested" ? "sent back for changes" : stopped[0].status}.`
      : !allSigned
        ? "The subscriber has not signed every Signature Page yet."
        : awaitingCountersign
          ? "Countersign the pages waiting for you first."
          : null;
  return { steps, current, canAccept: executed && !acceptedAt && stopped.length === 0, blocker };
}
