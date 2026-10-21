import type { Course, CourseLesson, CoachStep } from "@/lib/learning/course-types";

/**
 * Closing playbook: the second coach format course, for Stage 4 Closing.
 *
 * Like the outreach playbook it stays out of FOUNDER_COURSES (so it does not change every founder's
 * overall progress figure) and is exposed only while the coach is on for it (course_coach_config).
 * Every step's menuPath and href must exist in the founder navigation; the unit test enforces it.
 * Content is educational. Modules on offering type, term sheets, valuation and closings explain what
 * each thing is and where it is recorded; the decisions are the founder's with their counsel. iCapOS
 * records pledges and indications of interest only; no money moves on the platform.
 */

export const CLOSING_PLAYBOOK_SLUG = "closing-playbook";

const STAGE2 = "Stage 2 – Preparation";
const STAGE4 = "Stage 4 – Closing";
const PREP = "Prep & practice";

function step(s: CoachStep): CoachStep {
  return s;
}

function lesson(slug: string, title: string, durationMinutes: number, content: string, keyPoints: string[], steps: CoachStep[]): CourseLesson {
  return { slug, title, durationMinutes, type: "lesson", content, keyPoints, steps };
}

export const CLOSING_PLAYBOOK: Course = {
  slug: CLOSING_PLAYBOOK_SLUG,
  title: "Closing Playbook",
  description: "A coached, twelve week plan for running diligence, structuring the round and closing it, with the Stage 4 tools in iCapOS.",
  longDescription:
    "Work through the closing stage one module a week, with an AI IR Coach that reads your own deal room, documents, pledges and updates before each session. Educational only: iCFO does not solicit securities, is not an investment adviser and nothing here is legal advice or promises a funding outcome. iCapOS records pledges and indications of interest only; no money moves on the platform.",
  instructor: "iCapOS Faculty",
  category: "Closing",
  level: "Intermediate",
  thumbnailAccent: "from-slate-900 to-blue-700",
  whatYouWillLearn: [
    "Open a deal room before an investor asks and keep one current version of every document",
    "Answer diligence questions within 24 hours",
    "Explain your offering type, your valuation and your use of funds in a few sentences",
    "Read a term sheet before the first one arrives",
    "Run the SPV or closing checklist from the first commitment to signatures",
    "Track written pledges against the raise and send investor updates on a cadence",
    "Set the reporting rhythm that starts the day the round closes",
  ],
  sections: [
    {
      slug: "closing",
      title: "Closing playbook",
      lessons: [
        lesson(
          "deal-room",
          "Open your deal room",
          10,
          "A deal room is a secure space where committed investors review your documents and ask questions. The documents you already uploaded are the start; the room is what makes them usable in diligence. Open it before an investor asks, not after.",
          ["Open the room before you are asked", "Load the current set only", "Check it daily"],
          [
            step({ title: "Open your deal room", instruction: "Open a deal room for a committed investor and load the first set: deck, financial model, cap table, incorporation documents.", menuPath: [STAGE4, "Deal Room"], href: "/founder/deal-room", minutes: 7, commonMistake: "Sending documents by email one at a time, so nothing is tracked and nothing is versioned." }),
            step({ title: "Set a daily room check", instruction: "Add a daily task to check the room for questions and requests.", menuPath: ["Workspace", "Tasks"], href: "/founder/tasks", minutes: 3, example: "Check deal room questions, every day at 9am." }),
          ],
        ),
        lesson(
          "documents",
          "Documents that pass diligence",
          10,
          "Investors in diligence read the same twelve documents in roughly the same order, and they notice dates. A financial model from March in a room opened in October is a question before it is a document. Current, labelled, one version each.",
          ["One current version of each document", "The date in the file name", "Nothing else in the room"],
          [
            step({ title: "Sort to one current version each", instruction: "Open Documents, keep the current version of each file with the date in its name, and archive the rest.", menuPath: [STAGE2, "Documents"], href: "/founder/documents", minutes: 10, commonMistake: "Leaving every version in the room and letting the investor guess which one is current." }),
          ],
        ),
        lesson(
          "diligence-answers",
          "Answer diligence within 24 hours",
          10,
          "Investors measure you by how you answer, not only by what you answer. Respond to every question within 24 hours, even when the answer is a date for the rest. Fulfil document requests promptly; speed signals seriousness.",
          ["Every question answered within 24 hours", "Partial answers carry a date", "Checked every morning"],
          [
            step({ title: "Answer open questions", instruction: "Open the deal room and answer every waiting question or document request, with a date for anything you cannot finish today.", menuPath: [STAGE4, "Deal Room"], href: "/founder/deal-room", minutes: 7, commonMistake: "Waiting until you have the perfect answer, and losing the investor to the delay." }),
            step({ title: "Keep the morning check", instruction: "Confirm the daily deal room check is on your Tasks with a time.", menuPath: ["Workspace", "Tasks"], href: "/founder/tasks", minutes: 3, example: "Deal room check, 9am, repeats daily." }),
          ],
        ),
        lesson(
          "offering-type",
          "Know your offering type",
          10,
          "SAFE, priced round, Reg CF, Reg D or SPV: each sets who can invest, what you disclose and how the closing runs. iCapOS records the type you attest to so your deal room, listing and SPV flow match it. This is educational content, not legal or securities advice; confirm the structure with your counsel.",
          ["Settle the structure with counsel once", "Attest it in iCapOS", "Give every investor the same one sentence"],
          [
            step({ title: "Confirm your offering type", instruction: "Open Offering type and confirm the attested type matches what you tell investors.", menuPath: [STAGE4, "Offering type"], href: "/founder/offering-type", minutes: 5, commonMistake: "Leaving the offering type unset, so each investor conversation starts from a different assumption." }),
            step({ title: "Book the counsel hour", instruction: "Add a task for one hour with counsel on the questions you cannot answer in one sentence.", menuPath: ["Workspace", "Tasks"], href: "/founder/tasks", minutes: 5, example: "Counsel: the two questions I cannot answer in one sentence." }),
          ],
        ),
        lesson(
          "term-sheet",
          "Read a term sheet before you get one",
          12,
          "A term sheet is short and every line moves money or control: valuation, amount, instrument, pro rata, liquidation preference, board seat, information rights. The Term sheet explainer walks each line in plain words so the first one you receive is not the first one you have read. Educational only, not legal advice.",
          ["Read a sample now, with no deadline", "Know the three lines you would push on", "Spend counsel time only on those"],
          [
            step({ title: "Walk the sample term sheet", instruction: "Open the Term sheet explainer, read the sample top to bottom, and mark the three lines you would negotiate.", menuPath: [PREP, "Term sheet explainer"], href: "/founder/term-sheet", minutes: 12, commonMistake: "Reading your first term sheet for the first time when it arrives with a deadline." }),
          ],
        ),
        lesson(
          "valuation",
          "Explain your valuation and use of funds",
          12,
          "Investors in diligence ask two questions about money: how did you get to the number, and what does the money buy. Valuation Studio shows the methods and comparables behind a seed valuation so you can explain yours in two sentences. Use of funds ties the raise to milestones with dates. Educational only.",
          ["Two sentences for the number", "Three dated lines for the money", "The same answer for every investor"],
          [
            step({ title: "Write the two valuation sentences", instruction: "Open Valuation Studio, pick the methods that fit your stage and sector, and write the method and the comparable set in two sentences.", menuPath: [STAGE2, "Valuation Studio"], href: "/founder/valuation", minutes: 8, commonMistake: "A valuation with no method behind it, and a use of funds that is a pie chart with no dates." }),
            step({ title: "Date the use of funds", instruction: "Write three use of funds lines, each tied to a milestone with a month.", menuPath: [STAGE2, "Valuation Studio"], href: "/founder/valuation", minutes: 4, example: "Pilot hardware by March; two hires by April; 18 months of runway." }),
          ],
        ),
        lesson(
          "closing-checklist",
          "Start the SPV or closing checklist",
          12,
          "An SPV pools investors into one vehicle; the closing checklist runs the same way whether or not you use one: checklist, open, participations, requirements, closing. iCapOS records pledges and indications of interest only; no money moves on the platform. Start the checklist before the first commitment, because every item on it takes longer than it looks.",
          ["Start before the first commitment", "Begin with the items that take longest", "Counsel and bank items set the critical path"],
          [
            step({ title: "Start the checklist", instruction: "Open SPVs and closings, start the checklist, and tick the items that are yours today.", menuPath: [STAGE4, "SPVs & closings"], href: "/founder/spvs", minutes: 8, commonMistake: "Waiting for commitments before setting up the vehicle, then losing weeks while investors wait." }),
            step({ title: "Book the long items", instruction: "Add tasks for the counsel and bank items, with dates.", menuPath: ["Workspace", "Tasks"], href: "/founder/tasks", minutes: 4, example: "Counsel: closing documents package, due in two weeks." }),
          ],
        ),
        lesson(
          "pledges",
          "Track pledges against the raise",
          10,
          "A pledge is an investor saying how much, in writing, before the paperwork. Capital Raise tracks pledges and indications of interest against your raise so you always know the gap and who is behind each number. Nothing here moves money; it is the scoreboard the closing runs on.",
          ["A pledge is a written amount and a date", "Record it the day you get it", "The gap sizes the outreach"],
          [
            step({ title: "Record written pledges", instruction: "Open Capital Raise and record every pledge you have in writing, with the amount and timing.", menuPath: [STAGE4, "Capital Raise"], href: "/founder/capital-raise", minutes: 6, commonMistake: "Counting verbal interest as committed money and discovering the real gap at closing." }),
            step({ title: "Ask for the written amount", instruction: "Add a task to ask two investors for their amount and timing in writing.", menuPath: ["Workspace", "Tasks"], href: "/founder/tasks", minutes: 4, example: "Ask for the amount and rough timing in writing, so I can plan the close." }),
          ],
        ),
        lesson(
          "investor-updates",
          "Send investor updates on a cadence",
          10,
          "Committed and prospective investors stay warm when they hear from you on a rhythm: one update a month, progress not hype, the same three sections every time. The AI drafts, you review and send.",
          ["One update a month, same day", "Numbers, what changed, what I need", "To everyone in the raise"],
          [
            step({ title: "Send this month's update", instruction: "Open the Investor update builder, let the AI draft the three sections, review and send.", menuPath: [STAGE4, "Investor update builder"], href: "/founder/investor-update", minutes: 10, commonMistake: "Sending one update when things are going well and going silent when they are not." }),
          ],
        ),
        lesson(
          "milestones",
          "Track the milestones you promised",
          10,
          "The milestones in your deck are promises. Write the three you will hit in the next 90 days as dated tasks, so every investor update reports against the same list and closing investors see you execute while the round is open. The Milestones page shows the ones iCapOS measures for you.",
          ["Three milestones for 90 days", "Each with a number and a date", "Reported in every update"],
          [
            step({ title: "Read your measured milestones", instruction: "Open Milestones and read which platform milestones you have reached.", menuPath: [STAGE4, "Milestones"], href: "/founder/milestones", minutes: 3 }),
            step({ title: "Write three dated milestones", instruction: "Add three tasks starting with Milestone, each with a number and a due date.", menuPath: ["Workspace", "Tasks"], href: "/founder/tasks", minutes: 7, example: "Milestone: first paid customer, by Jan 31.", commonMistake: "Listing milestones with no dates, so nobody, including you, can say whether they were hit." }),
          ],
        ),
        lesson(
          "closing-week",
          "Run the closing",
          12,
          "A closing is the checklist finished in order: documents final, participations confirmed, requirements met, closing review with counsel, then signatures. iCapOS tracks the checklist and the participations; the signing and the money happen with your counsel and your bank. The founder's job this week is chasing: every open item has a person and a date.",
          ["Every open item has a person and a date", "Quiet investors get a call, not an email", "Chase on a fixed day"],
          [
            step({ title: "Own and date every open item", instruction: "Open the closing review and put a name and a date on every open item.", menuPath: [STAGE4, "SPVs & closings"], href: "/founder/spvs", minutes: 8, commonMistake: "Waiting for counsel and investors to come back on their own, and letting a close drift by a month." }),
            step({ title: "Block the chase", instruction: "Add a task for the weekly chase of every open item, and a call to anyone who has gone quiet.", menuPath: ["Workspace", "Tasks"], href: "/founder/tasks", minutes: 4, example: "Wednesday: chase every open closing item; call anyone quiet." }),
          ],
        ),
        lesson(
          "after-close",
          "After the close: report and plan",
          10,
          "The raise is closed when the money is in and the close update has gone to every investor. Then two habits start: a reporting cadence, monthly update and quarterly board meeting, and a look at Analytics for what the next round will need. Investors who are reported to well are the first cheque in the next round.",
          ["Close update within a week", "Monthly update, quarterly board meeting", "Next round planned from this one's data"],
          [
            step({ title: "Set the board meeting cadence", instruction: "Open Board meeting prep and set the first quarterly meeting, with the prep kit two weeks before.", menuPath: [PREP, "Board meeting prep"], href: "/founder/board-prep", minutes: 6, commonMistake: "Going quiet after the close, and starting the next raise from scratch." }),
            step({ title: "Block the monthly update", instruction: "Put the monthly update day on your calendar as a repeating block.", menuPath: ["Workspace", "Calendar"], href: "/founder/calendar", minutes: 4, example: "Investor update, first Tuesday of the month." }),
          ],
        ),
      ],
    },
  ],
};
