import type { Course, CourseLesson, CoachStep } from "@/lib/learning/course-types";

/**
 * Investor outreach playbook: the first coach format course.
 *
 * Not registered in FOUNDER_COURSES on purpose. Registering a course changes every founder's
 * overall progress figure (it is averaged over the course count). It is exposed through the
 * catalog only after an admin turns the coach on for it (course_coach_config.enabled).
 *
 * Every step's menuPath and href must exist in the founder navigation. The unit test enforces it.
 * Content is educational. It never promises a funding outcome and is not investment advice.
 */

export const OUTREACH_PLAYBOOK_SLUG = "investor-outreach-playbook";

const STAGE3 = "Stage 3 – Marketing";

function step(s: CoachStep): CoachStep {
  return s;
}

function lesson(
  slug: string,
  title: string,
  durationMinutes: number,
  content: string,
  keyPoints: string[],
  steps: CoachStep[],
): CourseLesson {
  return { slug, title, durationMinutes, type: "lesson", content, keyPoints, steps };
}

export const OUTREACH_PLAYBOOK: Course = {
  slug: OUTREACH_PLAYBOOK_SLUG,
  title: "Investor Outreach Playbook",
  description:
    "A coached, step by step plan for reaching the right investors with the outreach tools in iCapOS.",
  longDescription:
    "Work through each outreach tool in the order it appears in your menu, with an AI IR Coach that checks in on every step. Educational only: iCFO does not solicit securities, is not an investment adviser, and nothing here promises a funding outcome.",
  instructor: "iCapOS Faculty",
  category: "Investor Outreach",
  level: "Beginner",
  thumbnailAccent: "from-blue-700 to-slate-900",
  whatYouWillLearn: [
    "Set a weekly outreach target you can keep",
    "Review your investor matches and request introductions",
    "Run manual outreach and follow up on time",
    "Post consistently from your Social media page",
    "Use automated outreach and your IR Agent once you qualify",
    "Prepare to present and network at events",
    "Turn all of it into Tasks and Calendar commitments",
  ],
  sections: [
    {
      slug: "playbook",
      title: "Outreach playbook",
      lessons: [
        lesson(
          "game-plan",
          "Your outreach game plan",
          10,
          "Outreach works when it is a weekly habit with a number attached. Pick the number first, then use the tools below to hit it.",
          ["Choose one weekly outreach target", "Know which tools unlock at your stage", "Review progress every week"],
          [
            step({
              title: "Open your journey",
              instruction: "Check which stage you are in and which outreach tools are open to you today.",
              menuPath: ["Stage 1 – Onboarding", "My Progress"],
              href: "/founder/journey",
              minutes: 3,
              commonMistake: "Skipping this and starting with a tool that is still locked.",
            }),
            step({
              title: "Write your weekly target",
              instruction: "Decide how many investor contacts you will reach each week and write the number down.",
              menuPath: ["Workspace", "Tasks"],
              href: "/founder/tasks",
              minutes: 5,
              example: "Reach 10 new investors and send 5 follow ups every week.",
            }),
          ],
        ),
        lesson(
          "matches-introductions",
          "Matches and introduction requests",
          12,
          "Your investor matches are the shortest list of investors whose focus fits your company. Start there before writing to anyone cold.",
          ["Read why each investor matched", "Request introductions for the best fits", "Do not ask for an introduction you have not prepared for"],
          [
            step({
              title: "Open Investor matches",
              instruction: "Review your matches and read the reason each investor was suggested.",
              menuPath: [STAGE3, "Investor matches"],
              href: "/founder/matches",
              minutes: 5,
              commonMistake: "Contacting every match. Choose the few whose stage and sector fit you best.",
            }),
            step({
              title: "Request introductions",
              instruction: "Pick your best fits and request introductions through iCapOS.",
              menuPath: [STAGE3, "Investor matches"],
              href: "/founder/matches",
              minutes: 7,
              example: "Request three introductions this week and note the date in Tasks.",
            }),
          ],
        ),
        lesson(
          "manual-outreach",
          "Manual outreach and follow ups",
          15,
          "Manual outreach is available from the start. Most replies come after a follow up, so the follow up is part of the plan, not an extra.",
          ["Keep contacts current", "Send a short, specific first message", "Follow up on a schedule"],
          [
            step({
              title: "Check My contacts",
              instruction: "Open your contacts and confirm the investors you plan to reach have an email and a short note.",
              menuPath: [STAGE3, "My contacts"],
              href: "/founder/contacts",
              minutes: 5,
            }),
            step({
              title: "Send from Outreach",
              instruction: "Open Outreach, choose the Outreach: Manual tab, and send your first messages. The AI drafts, you review and send.",
              menuPath: [STAGE3, "Outreach"],
              href: "/founder/deploy",
              control: "Outreach: Manual",
              learningId: "outreach-manual",
              minutes: 10,
              commonMistake: "Sending a long generic message. Lead with why this investor, in two sentences.",
            }),
            step({
              title: "Schedule your follow ups",
              instruction: "Add a follow up task for each message you sent.",
              menuPath: ["Workspace", "Tasks"],
              href: "/founder/tasks",
              minutes: 5,
              example: "Follow up 5 business days after the first message.",
            }),
          ],
        ),
        lesson(
          "social-media",
          "Social media outreach",
          10,
          "Consistent posts keep you visible to investors who have not heard from you yet. Aim for a rhythm you can sustain.",
          ["Connect one account first", "Post on a schedule", "Use the investor update angle: progress, not hype"],
          [
            step({
              title: "Open Social media",
              instruction: "Connect an account and review your plan's monthly post limit.",
              menuPath: [STAGE3, "Social media"],
              href: "/founder/deploy/social",
              minutes: 5,
            }),
            step({
              title: "Schedule this week's post",
              instruction: "Write one post about a real milestone and schedule it.",
              menuPath: [STAGE3, "Social media"],
              href: "/founder/deploy/social",
              minutes: 8,
              commonMistake: "Promising returns or a raise outcome. Keep it factual about your company.",
            }),
          ],
        ),
        lesson(
          "automated-outreach",
          "Automated outreach",
          10,
          "Automated outreach opens when your Capital Readiness Rating clears the outreach gate. Until then, keep building momentum with manual outreach.",
          ["Know the gate", "Review before anything sends", "Watch replies and act on them"],
          [
            step({
              title: "Check your gate status",
              instruction: "Open Outreach and read whether automated outreach is open or paused for your rating.",
              menuPath: [STAGE3, "Outreach"],
              href: "/founder/deploy",
              control: "Outreach: Automated",
              learningId: "outreach-automated",
              minutes: 4,
            }),
            step({
              title: "Review the ranked list",
              instruction: "If it is open, review the ranked contacts and approve only the ones you would write to yourself.",
              menuPath: [STAGE3, "Outreach"],
              href: "/founder/deploy",
              minutes: 8,
            }),
          ],
        ),
        lesson(
          "ir-agent",
          "Your IR Agent",
          10,
          "The IR Agent can talk to prospects for you. You decide what it knows and what it says, and you review what it books.",
          ["Customize the agent to your company", "Review conversations", "Confirm meetings yourself"],
          [
            step({
              title: "Open My IR Agent",
              instruction: "Review how your agent introduces your company and correct anything that is out of date.",
              menuPath: [STAGE3, "My IR Agent"],
              href: "/founder/ir-agent",
              minutes: 8,
              commonMistake: "Leaving the default text. Add your real stage, sector and what you are raising for.",
            }),
          ],
        ),
        lesson(
          "events",
          "Present and network at events",
          10,
          "Events turn cold outreach into warm conversations. Prepare one short pitch and one clear ask.",
          ["Pick events that match your stage", "Prepare a 60 second pitch", "Follow up within two days"],
          [
            step({
              title: "Open Present at event",
              instruction: "Review the events you can present at and pick one to prepare for.",
              menuPath: [STAGE3, "Present at event"],
              href: "/founder/events/present",
              minutes: 6,
            }),
            step({
              title: "Put it on your calendar",
              instruction: "Add the event and a follow up block to your calendar.",
              menuPath: ["Workspace", "Calendar"],
              href: "/founder/calendar",
              minutes: 4,
            }),
          ],
        ),
        lesson(
          "plan-goals",
          "Plan and set goals",
          10,
          "Turn the plan into dated commitments. What is not on your Tasks and Calendar usually does not happen.",
          ["One weekly review", "Every outreach action has a date", "Adjust the target, not the habit"],
          [
            step({
              title: "Plan next week in Tasks",
              instruction: "List next week's outreach actions with due dates.",
              menuPath: ["Workspace", "Tasks"],
              href: "/founder/tasks",
              minutes: 6,
            }),
            step({
              title: "Block time on Calendar",
              instruction: "Reserve a weekly outreach block you will protect.",
              menuPath: ["Workspace", "Calendar"],
              href: "/founder/calendar",
              minutes: 4,
            }),
          ],
        ),
      ],
    },
  ],
};
