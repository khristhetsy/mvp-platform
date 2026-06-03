import {
  INVESTOR_PIPELINE_STAGES,
  buildAdminPipelineUpdatePatch,
  filterAdminPipelineRows,
  isPipelineFollowUpDue,
} from "../src/lib/investor-crm/pipeline-logic";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function testStages() {
  assert(INVESTOR_PIPELINE_STAGES.includes("interested"), "includes interested");
  assert(INVESTOR_PIPELINE_STAGES.includes("follow_up"), "includes follow_up");
  assert(INVESTOR_PIPELINE_STAGES.length === 3, "exactly three stages");
}

function testBuildPatch() {
  const now = new Date("2026-06-01T12:00:00.000Z");
  const patch = buildAdminPipelineUpdatePatch(
    {
      stage: "follow_up",
      probability: 80,
      notes: "Call next week",
      nextFollowUpAt: "2026-06-10T09:00:00.000Z",
      markContacted: true,
    },
    now,
  );

  assert(patch.stage === "follow_up", "stage applied");
  assert(patch.probability === 80, "probability applied");
  assert(patch.notes === "Call next week", "notes applied");
  assert(patch.next_follow_up_at === "2026-06-10T09:00:00.000Z", "follow-up applied");
  assert(patch.last_contacted_at === now.toISOString(), "markContacted sets last_contacted_at");
  assert(patch.updated_at === now.toISOString(), "updated_at set");

  const cleared = buildAdminPipelineUpdatePatch({ clearFollowUp: true }, now);
  assert(cleared.next_follow_up_at === null, "clearFollowUp nulls follow-up");
}

function testFollowUpDue() {
  const now = new Date("2026-06-05T12:00:00.000Z");
  assert(isPipelineFollowUpDue("2026-06-04T12:00:00.000Z", now), "past due");
  assert(!isPipelineFollowUpDue("2026-06-06T12:00:00.000Z", now), "not due yet");
  assert(!isPipelineFollowUpDue(null, now), "null not due");
}

function testFilterRows() {
  const rows = [
    {
      id: "1",
      investor_id: "inv-a",
      company_id: "co-1",
      stage: "interested",
      next_follow_up_at: "2026-06-01T00:00:00.000Z",
      investor_name: "Alice",
      investor_email: null,
      company_name: "Acme",
      notes: null,
    },
    {
      id: "2",
      investor_id: "inv-b",
      company_id: "co-2",
      stage: "follow_up",
      next_follow_up_at: null,
      investor_name: "Bob",
      investor_email: null,
      company_name: "Beta",
      notes: null,
    },
  ];
  const now = new Date("2026-06-05T12:00:00.000Z");

  assert(filterAdminPipelineRows(rows, { followUpDueOnly: true }, now).length === 1, "due filter");
  assert(filterAdminPipelineRows(rows, { q: "bob" }, now).length === 1, "search filter");
  assert(filterAdminPipelineRows(rows, { stage: "follow_up" }, now).length === 1, "stage filter");
}

testStages();
testBuildPatch();
testFollowUpDue();
testFilterRows();
console.log(JSON.stringify({ passed: true, tests: 4 }, null, 2));
