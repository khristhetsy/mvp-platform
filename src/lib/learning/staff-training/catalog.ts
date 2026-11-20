/**
 * Staff Training catalog: the syllabus as data. Three modules are written (status "ready").
 * The rest are listed so the admin sees the whole program, and open as "coming soon" for trainees.
 * Audience: "both" is shown to iCFO staff and to licensee users, "staff" to iCFO staff only,
 * "licensee" to licensee users only.
 */

export type TrainingAudience = "staff" | "licensee";
export type ModuleAudience = "both" | "staff" | "licensee";
export type ModuleStatus = "ready" | "planned";

export type TrainingStep = {
  title: string;
  intro: string;
  doTitle: string;
  doList: string[];
  noteTitle: string;
  notes: string[];
};

export type TrainingExercise = { title: string; prompt: string };

export type TrainingModule = {
  key: string;
  part: string;
  title: string;
  menuSection: string;
  audience: ModuleAudience;
  status: ModuleStatus;
  goal: string;
  steps?: TrainingStep[];
  exercises?: TrainingExercise[];
};

const PLANNED = (
  key: string,
  part: string,
  title: string,
  menuSection: string,
  audience: ModuleAudience,
  goal: string,
): TrainingModule => ({ key, part, title, menuSection, audience, status: "planned", goal });

const MENU_MODULE: TrainingModule = {
  key: "menu-features-functions",
  part: "1 Foundations",
  title: "1.1 Menu, features and functions",
  menuSection: "Whole workspace",
  audience: "both",
  status: "ready",
  goal: "Find any page and use the top bar tools without help.",
  steps: [
    {
      title: "Learn the workspace layout",
      intro: "The workspace has a menu on the left, a top bar across the page, and the page in the middle. The apps home, opened from the grid button, shows one tile for each menu section.",
      doTitle: "Do this",
      doList: [
        "Open the grid button at the top left to see the apps home.",
        "Find the sidebar menu on the left and the top bar with Search, Select company, Reminders and Notifications.",
        "Open the Dashboard and read its three panels: Platform health, Operational priorities and Upcoming meetings.",
      ],
      noteTitle: "Remember",
      notes: ["Everything starts from the Dashboard.", "Collapse the sidebar when you need more room for the page."],
    },
    {
      title: "Walk the sidebar sections",
      intro: "Sections with an arrow expand to show their items. Single pages open directly.",
      doTitle: "Do this",
      doList: [
        "Open each sidebar section once and read its item names.",
        "Note which sections are for Customer Support and which are for Administration and System.",
        "Use the Operations Manual when you are unsure what a page is for.",
      ],
      noteTitle: "Remember",
      notes: ["System pages are for platform upkeep. Changes there need approval."],
    },
    {
      title: "Find anything with Search",
      intro: "Search jumps straight to a page or a record, so you do not need to know where it sits in the menu.",
      doTitle: "Do this",
      doList: [
        "Press the Search shortcut or select the Search box in the top bar.",
        "Type part of a page name, such as support.",
        "Pick the best match. Its menu path is shown under its name.",
      ],
      noteTitle: "Remember",
      notes: ["Search also finds contacts, so check you opened the page you meant before you act."],
    },
    {
      title: "Work inside one company",
      intro: "Select company in the top bar puts you inside one company's account.",
      doTitle: "Do this",
      doList: [
        "Open Select company and choose the company.",
        "Check the company name before you change anything.",
        "Clear the selection when you are done.",
      ],
      noteTitle: "Remember",
      notes: ["Never change a field the client set themselves."],
    },
    {
      title: "Reminders, notifications and the assistant",
      intro: "Reminders hold your tasks. Notifications hold alerts. Ask iCapOS answers questions about what needs attention.",
      doTitle: "Do this",
      doList: [
        "Open Reminders and clear the items you have finished.",
        "Read your unread Notifications at the start of each day.",
        "Ask iCapOS what needs attention, then check its answer before you act.",
      ],
      noteTitle: "Remember",
      notes: ["AI answers can be wrong. The assistant gives workflow guidance only, not legal, tax or investment advice."],
    },
  ],
  exercises: [
    { title: "Find it fast", prompt: "Using Search only, open the Support log. Then reach the same page through the menu. Say which was quicker and why." },
    { title: "Walk the menu", prompt: "Open Sales, Marketing and Events. For each, write the item you would use first and why." },
    { title: "Handle a task", prompt: "A client says their plan looks wrong. Write the menu path you would follow to check it, in order." },
  ],
};

const COMPANY_MODULE: TrainingModule = {
  key: "support-company",
  part: "2 Customer Support",
  title: "2.1 Company",
  menuSection: "Customer Support > Companies",
  audience: "both",
  status: "ready",
  goal: "Know where each company is in the four stages and help it reach the next one.",
  steps: [
    {
      title: "Go through the Customer Support submenu",
      intro: "Start by knowing every item under Customer Support, so you know where each kind of work lives.",
      doTitle: "Do this",
      doList: [
        "Open Customer Support in the sidebar.",
        "Open each item once: Companies, Investors, Support queue, Support log, Stuck founders, Brokered Intros and AI usage and cost.",
        "Note what each page shows before you use it.",
      ],
      noteTitle: "Remember",
      notes: ["Companies is where you review each company's stage and plan."],
    },
    {
      title: "Review each company and its stage",
      intro: "Every company is somewhere in four stages: Onboarding, Preparation, Marketing and Closing.",
      doTitle: "Do this",
      doList: [
        "Open Companies and read the Stage and Plan columns.",
        "Identify the stage each company is at.",
        "Open a company to see what is blocking its next stage.",
      ],
      noteTitle: "Remember",
      notes: ["Review each company, not only the ones that wrote to support."],
    },
    {
      title: "Use the AI email draft, and always review it",
      intro: "The platform drafts an email for each company. The draft helps you start, but you are the final check.",
      doTitle: "Do this",
      doList: [
        "Open the AI email draft for the company.",
        "Read it against the company's real stage and plan.",
        "Correct anything wrong, then send.",
      ],
      noteTitle: "Never",
      notes: ["Never send a draft you have not fully read.", "Never promise a refund, a credit, or an outcome."],
    },
    {
      title: "Help the company unlock the next stage",
      intro: "Your job is to keep the process moving until the company completes the stage.",
      doTitle: "Do this",
      doList: [
        "Name the one thing that unlocks the next stage.",
        "Tell the client plainly what it is and where to do it.",
        "Note the next action in the Notes Log.",
      ],
      noteTitle: "Remember",
      notes: ["Automatic emails and nudges also go out until the stage is done, so check the Notes Log first to avoid repeating them."],
    },
    {
      title: "Repeat weekly, and plan for Stage 4",
      intro: "Put the company review on your calendar every week as part of your planning.",
      doTitle: "Do this",
      doList: [
        "Add a weekly company review block to your calendar.",
        "Work through the companies from the earliest stage to the latest.",
        "Once a company completes all four stages, help with outreach improvement and deal closing.",
      ],
      noteTitle: "Remember",
      notes: ["Consistency matters more than length. A short review every week keeps companies moving."],
    },
  ],
  exercises: [
    { title: "Stage review", prompt: "Review three companies. Name the stage of each and the one thing that would unlock its next stage." },
    { title: "Draft check", prompt: "The AI draft tells a company it is in Marketing when it is still in Preparation. Find the error and write the corrected opening paragraph." },
    { title: "Weekly plan", prompt: "Write your weekly company review plan: when it is on your calendar and the order you review companies in." },
  ],
};

const QUEUE_MODULE: TrainingModule = {
  key: "support-queue",
  part: "2 Customer Support",
  title: "2.2 Support queue",
  menuSection: "Customer Support > Support queue",
  audience: "both",
  status: "ready",
  goal: "Resolve a client request from open to closed.",
  steps: [
    {
      title: "Open the queue and review a ticket",
      intro: "Start every session with the oldest open ticket, because the 48 hour clock runs from when the client wrote.",
      doTitle: "Do this",
      doList: [
        "Open the support queue in Admin > Support.",
        "Sort or scan by age. Oldest first.",
        "Select a ticket and read the whole thread, not only the last message.",
        "Identify the client, the company, its plan and its stage.",
        "Decide what the client actually needs: an answer, a fix, a how to, or an escalation.",
        "Check the Notes Log for earlier emails, so you do not repeat or contradict them.",
      ],
      noteTitle: "Before you reply, know",
      notes: [
        "The question: what exactly is being asked.",
        "The facts: what the platform shows for that account.",
        "The owner: whether you can resolve it, or it needs Senior Tech Support.",
      ],
    },
    {
      title: "Respond with the AI draft, then correct it",
      intro: "The AI draft saves time, but it can be wrong, so you are the final check. Never send a draft you have not fully read.",
      doTitle: "Do this",
      doList: [
        "Generate the AI draft for the ticket.",
        "Read it against the facts you gathered in Step 1.",
        "Correct anything wrong: plan, price, dates, feature names, steps, and promises.",
        "Use AI rewrite (Shorter, Friendlier) for tone only, then read the new text again.",
        "Send, and note the next action in the ticket.",
      ],
      noteTitle: "Check every draft for",
      notes: [
        "Accuracy: every fact matches the account and current platform behavior.",
        "No refund or credit promises: never say iCapOS will refund or credit the client.",
        "No field changes: never offer to change a field the client set themselves.",
        "No empty promises: never say you will check, confirm or provide something iCapOS does not have or cannot do.",
        "No outcome promises: no funding promises, no investor response claims, no unsourced numbers.",
        "One clear next step: the client knows what happens next.",
        "Plain tone: short and specific.",
      ],
    },
    {
      title: "Self submit a ticket",
      intro: "Use self submit when a client reached you outside the queue (phone, email, chat, in person) and the request needs a ticket so it is tracked.",
      doTitle: "Do this",
      doList: [
        "Open the self submit ticket feature.",
        "Select the client and company.",
        "Write a clear subject and describe the request in the client's own terms.",
        "Record how it reached you and the date.",
        "Submit it, then work it like any other ticket.",
      ],
      noteTitle: "Rules",
      notes: [
        "One request per ticket: keep tickets easy to resolve and close.",
        "Facts only: write what the client said, not your guess about the cause.",
        "Same clock: the 48 hour turnaround starts when the client first asked, not when you submitted.",
      ],
    },
    {
      title: "Access as client",
      intro: "Use Access as client only when you must log in as the client to resolve the issue on their behalf, and a reply or guide would not solve it. It is a last resort for hands on fixes, not a way to browse accounts.",
      doTitle: "How to use it",
      doList: [
        "Note the ticket and the reason before you switch.",
        "Switch in, do only what the ticket requires, and nothing else.",
        "Switch out as soon as the work is done, using the off switch.",
        "Record in the ticket what you did and why.",
      ],
      noteTitle: "Limits",
      notes: [
        "No sending as the client: email as the founder stays blocked while you act as them.",
        "No overriding their choices: never change a field the client set themselves.",
        "No billing changes: billing stays with the client unless the ticket is a billing issue and a senior team member approves.",
        "Tell the client: say in your reply that you acted on their account and what you did.",
      ],
    },
    {
      title: "Close out the ticket",
      intro: "Close a ticket only when the issue is resolved and the client has what they need. Closing too early reopens work and costs trust.",
      doTitle: "Do this",
      doList: [
        "Confirm the fix works, or that the client's question was fully answered.",
        "Send a short final message that states the outcome.",
        "Write the resolution in the ticket: cause, action taken, and who did it.",
        "Mark the ticket closed.",
        "If you used Access as client, confirm you switched out.",
      ],
      noteTitle: "Do not close if",
      notes: [
        "The client has not confirmed, and the issue could still be present.",
        "An escalation is open and Senior Tech Support has not finished.",
        "A promise is pending: you told the client something would follow.",
      ],
    },
    {
      title: "Schedule daily, watch notifications, escalate",
      intro: "Put one recurring support queue block on your calendar every day, and turn on notifications so a request for assistance reaches you between blocks.",
      doTitle: "Daily routine",
      doList: [
        "Open the queue at your calendar block.",
        "Answer the oldest open tickets first, following Steps 1 and 2.",
        "Handle any notification asking for assistance as soon as you see it.",
        "Close resolved tickets, following Step 5.",
        "Before the block ends, note the next action on every ticket still open.",
      ],
      noteTitle: "Escalate complex tech support to Senior Tech Support",
      notes: [
        "Decide it is complex: you cannot resolve it with a reply, a guide, or Access as client.",
        "Hand it to Senior Tech Support with the ticket, the client, what you tried, and what you saw.",
        "Notify the customer in the same hour. Tell them plainly that a senior technical specialist now has the issue.",
        "Do not promise a fix date, and do not promise anything iCapOS cannot deliver.",
        "Keep the ticket open and watch it until Senior Tech Support returns it, then follow up with the client.",
        "Close it only after the client confirms the issue is resolved.",
      ],
    },
  ],
  exercises: [
    { title: "Wrong draft", prompt: "The AI draft tells a client their plan includes something it does not. Find the error, fix the draft, and explain what you checked." },
    { title: "Phone request", prompt: "A client calls asking for help with a failed upload. Self submit the ticket and write its subject and description." },
    { title: "Escalation", prompt: "A client reports a problem you cannot reproduce even after Access as client. Write the handoff to Senior Tech Support and the message to the customer." },
  ],
};

export const STAFF_TRAINING_MODULES: TrainingModule[] = [
  MENU_MODULE,
  COMPANY_MODULE,
  QUEUE_MODULE,
  PLANNED("support-investors-stuck", "2 Customer Support", "2.3 Investors and Stuck founders", "Customer Support", "staff", "Support investor accounts and re-engage founders who have stalled."),
  PLANNED("support-intros-ai-cost", "2 Customer Support", "2.4 Brokered Intros, AI usage and cost", "Customer Support", "staff", "Track brokered introductions and keep AI spend under control."),
  PLANNED("sales-contacts", "3 Sales and Marketing", "3.1 Contacts", "Contacts", "staff", "Find, create and update contact records."),
  PLANNED("sales", "3 Sales and Marketing", "3.2 Sales", "Sales", "staff", "Run deals from Opportunities through Pipeline to Contracts."),
  PLANNED("marketing", "3 Sales and Marketing", "3.3 Marketing", "Marketing", "staff", "Build and send campaigns, sequences and templates."),
  PLANNED("social-linkedin", "3 Sales and Marketing", "3.4 Social Media and LinkedIn", "Social Media, LinkedIn", "staff", "Plan posts and run LinkedIn outreach."),
  PLANNED("ai-agent", "3 Sales and Marketing", "3.5 AI Agent", "AI Agent", "staff", "Understand the AI agents and how they are set up."),
  PLANNED("investor-relations", "4 Investors and Events", "4.1 Investor Relations", "Investor Relations", "staff", "Manage founder deal flow."),
  PLANNED("investor-directory", "4 Investors and Events", "4.2 Investor Directory", "Investor Directory", "staff", "Work with public investor data and control who can use it."),
  PLANNED("events", "4 Investors and Events", "4.3 Events", "Events", "staff", "Run an investor event from invitation to follow up."),
  PLANNED("voice", "4 Investors and Events", "4.4 Voice", "Voice", "staff", "Run AI calling campaigns and review calls."),
  PLANNED("communication", "5 Operations", "5.1 Communication", "Communication", "staff", "Manage email, calendar and meetings."),
  PLANNED("daily-work-tools", "5 Operations", "5.2 Daily work tools", "Operational Tools", "staff", "Keep up with tasks, alerts, feeds and reports."),
  PLANNED("deal-rooms-diligence", "5 Operations", "5.3 Deal rooms and diligence", "Operational Tools", "staff", "Support deals after matching."),
  PLANNED("accounting", "5 Operations", "5.4 Accounting", "Accounting", "staff", "Invoicing, payments and bank activity."),
  PLANNED("learning", "5 Operations", "5.5 Learning", "Learning", "staff", "The founder learning programs."),
  PLANNED("ceo-manual", "5 Operations", "5.6 CEO hub and Operations Manual", "CEO, Operations Manual", "staff", "Use the CEO page and the manual as the reference for every process."),
  PLANNED("admin-users", "6 Administration", "6.1 Users, permissions and profile", "Administration", "staff", "User Management, User Permissions, My Profile."),
  PLANNED("admin-billing", "6 Administration", "6.2 Billing, pricing and accounts", "Administration", "staff", "Reviewed with a senior team member, since these change what clients pay."),
  PLANNED("admin-feature-controls", "6 Administration", "6.3 Feature Controls and integrations", "Administration", "staff", "Which features are switched on, and how outside tools connect."),
  PLANNED("system-upkeep", "6 Administration", "6.4 System upkeep", "System", "staff", "Read only for most staff. Changes need approval."),
  PLANNED("licensee-stage-1", "Licensee track", "L2 Stage 1: customer onboarding", "Licensee platform", "licensee", "Licensee only session."),
  PLANNED("licensee-stage-2", "Licensee track", "L3 Stage 2: preparation tools", "Licensee platform", "licensee", "Licensee only session."),
  PLANNED("licensee-stage-3", "Licensee track", "L4 Stage 3: outreach", "Licensee platform", "licensee", "Licensee only session."),
  PLANNED("licensee-stage-4", "Licensee track", "L5 Stage 4: customer closing", "Licensee platform", "licensee", "Licensee only session."),
  PLANNED("licensee-stage-5", "Licensee track", "L6 Stage 5: communication", "Licensee platform", "licensee", "Licensee only session."),
];

export function getTrainingModule(key: string): TrainingModule | null {
  return STAFF_TRAINING_MODULES.find((m) => m.key === key) ?? null;
}

/** Modules a trainee of this audience can see. */
export function modulesForAudience(audience: TrainingAudience): TrainingModule[] {
  return STAFF_TRAINING_MODULES.filter((m) => m.audience === "both" || m.audience === audience);
}

export function isTrainingAudience(v: unknown): v is TrainingAudience {
  return v === "staff" || v === "licensee";
}

export function readyModuleCount(modules: TrainingModule[] = STAFF_TRAINING_MODULES): number {
  return modules.filter((m) => m.status === "ready").length;
}
