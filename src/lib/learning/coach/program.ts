/**
 * The coached program for the Investor Outreach Playbook: one module a week, then a Monday review.
 *
 * Every module runs the same way: recall last week, read the lesson with a worked case, answer a
 * question about your own company, do the step on the live screen, three select questions, the
 * answers explained, and one if-then commitment that becomes a dated task. Lesson text, key points
 * and common mistakes come from the playbook itself (outreach-playbook.ts). Everything here is the
 * coaching layer around it. Pure data, no imports from the database.
 *
 * Worked cases are illustrative founders built from the lesson, never a founder on the platform.
 * Encouragement lines are tied to something the founder did; a gentle line still names the miss.
 * Nothing here promises a funding outcome.
 */
import type { CoachTone } from "@/lib/learning/coach/tones";

export type ProgramChoice = { label: string; reply: string };

export type ProgramQuestion = {
  prompt: string;
  options: string[];
  rightIndex: number;
  /** Shown after the test: why the right answer is right, and what it means for this founder. */
  why?: string;
};

export type ProgramCase = { title: string; setup: string; lines: string[]; rule: string };

/** Which live read the Do step counts. */
export type ProgramMetric =
  | "contacts_ready" | "intro_requests" | "social" | "automated" | "ir_agent" | "events" | "sends" | "tasks"
  | "deal_rooms" | "documents" | "room_check" | "offering_attested" | "checklist" | "pledges" | "updates_30d" | "milestone_tasks" | "self_report";

export type ProgramScreen = { path: string; title: string; href: string };

export type ProgramModule = {
  lessonSlug: string;
  week: number;
  shortTitle: string;
  /** Minutes for the whole coached module (lesson minutes plus the test and the commitment). */
  minutes: number;
  intro: string;
  readScreen: ProgramScreen;
  readNote: string;
  case: ProgramCase;
  companyQuestion: string;
  companyOptions: ProgramChoice[];
  companyFollowUp: string;
  companyFollowUpReply: string;
  doScreen: ProgramScreen;
  doMetric: ProgramMetric;
  doIntro: string;
  doTarget: number;
  doVerb: string;
  doDone: string;
  recall: ProgramQuestion[];
  tests: ProgramQuestion[];
  commitHint: string;
  commitDone: string;
  /** Questions founders ask the coach on this module, with the answer from the lesson and their data. */
  faq?: Array<[string, string]>;
  /** What the coach says after "I am stuck": the exact menu path and click for this module. */
  stuckHelp?: string;
};

export type ProgramReview = {
  lessonSlug: string;
  shortTitle: string;
  minutes: number;
  intro: string;
  recall: ProgramQuestion[];
  companyQuestion: string;
  companyOptions: ProgramChoice[];
  companyFollowUp: string;
  companyFollowUpReply: string;
  commitHint: string;
  commitDone: string;
  faq?: Array<[string, string]>;
};

export type ProgramBenchmark = { key: string; label: string; lessonTarget: string; stage: string; industry: string };

/** One coached course: its weekly modules, the review that follows them, and the benchmarks for its panel. */
export type ProgramDefinition = {
  courseSlug: string;
  title: string;
  modules: ProgramModule[];
  review: ProgramReview;
  benchmarks: ProgramBenchmark[];
  sources: string[];
};

export const PROGRAM_MINUTES_PER_PHASE = 7;

const CONTACTS: ProgramScreen = { path: "Stage 3 Marketing › My contacts", title: "My contacts", href: "/founder/contacts" };
const JOURNEY: ProgramScreen = { path: "Stage 1 Onboarding › My Progress", title: "My Progress", href: "/founder/journey" };
const MATCHES: ProgramScreen = { path: "Stage 3 Marketing › Investor matches", title: "Investor matches", href: "/founder/matches" };
const SOCIAL: ProgramScreen = { path: "Stage 3 Marketing › Social media", title: "Social media", href: "/founder/deploy/social" };
const OUTREACH: ProgramScreen = { path: "Stage 3 Marketing › Outreach", title: "Outreach", href: "/founder/deploy" };
const IR_AGENT: ProgramScreen = { path: "Stage 3 Marketing › My IR Agent", title: "My IR Agent", href: "/founder/ir-agent" };
const EVENTS: ProgramScreen = { path: "Stage 3 Marketing › Present at event", title: "Present at event", href: "/founder/events/present" };
const TASKS: ProgramScreen = { path: "Workspace › Tasks", title: "Tasks", href: "/founder/tasks" };

export const PROGRAM_MODULES: ProgramModule[] = [
  {
    lessonSlug: "game-plan",
    week: 1,
    shortTitle: "Game plan",
    minutes: 12,
    intro: "Week 1 of 8 is about getting a first batch of messages ready. Recall starts in week 2; each week after this opens with two questions on last week and a check of the task you committed to.",
    readScreen: JOURNEY,
    readNote: "On the right is your My Progress page: which outreach tools are open to you today and which are still locked.",
    case: {
      title: "Seed stage medtech, raising $1.5M",
      setup: "Priya has 22 investor contacts from two conferences, a readiness score of 58, and four weeks before her runway forces a decision. She opens the playbook on a Monday.",
      lines: [
        "Checks My Progress: manual outreach open, automated locked under the gate. Manual sends only.",
        "Counts what she can use: 22 contacts, 7 with both an email and a note. Seven is the real number, not 22.",
        "Writes the target as numbers with a period, 10 new and 5 follow ups a week, and puts it in Tasks with a Friday check.",
      ],
      rule: "Reach 10 new investors and send 5 follow ups every week, and count ready contacts before setting the number.",
    },
    companyQuestion: "If your target is 10 investors this week and fewer contacts are ready to message, how would you close the gap?",
    companyOptions: [
      { label: "Add emails to contacts that already have a note", reply: "Right call. A contact with a note but no email is the cheapest one to make ready: no new writing, just the address. You are working on the number you control." },
      { label: "Lower my target for now", reply: "That makes the gap disappear, but it moves the goal instead of closing it. Fair as a short term choice if you write down when it goes back up." },
      { label: "Send to everyone anyway", reply: "That sends to people you cannot email, and anyone without a note gets a generic message. The lesson warns against exactly that." },
    ],
    companyFollowUp: "Which contacts first, and why those? You know them, I only see rows.",
    companyFollowUpReply: "Good, that is a reason an investor can hear too. My contacts is on the right.",
    doScreen: CONTACTS,
    doMetric: "contacts_ready",
    doIntro: "Add an email or a short note to the contacts that are missing one, on the right. I count ready contacts, those with both.",
    doTarget: 10,
    doVerb: "Make ready",
    doDone: "That is a first batch. Three quick questions before you commit.",
    recall: [],
    tests: [
      { prompt: "Before you start outreach, what should you check first?", options: ["Which outreach tools are open to you at your stage", "How many contacts you can import", "Whether investors have replied yet"], rightIndex: 0, why: "A locked tool cannot send for you, which is the lesson's common mistake." },
      { prompt: "Which weekly target can you track?", options: ["Reach 10 new investors and send 5 follow ups every week", "Reach out to more investors", "Get a meeting with a lead investor"], rightIndex: 0, why: "It has numbers you control and a time period. A meeting depends on the investor." },
      { prompt: "A contact counts as ready when it has what?", options: ["An email and a short note", "A LinkedIn profile", "A deck sent"], rightIndex: 0, why: "Sending needs an email, and a personal message needs the note." },
    ],
    commitHint: "send first messages to my ready contacts from Outreach: Manual",
    commitDone: "Module 1 is done. The sending happens on your date, and that is what I check first next week.",
    faq: [
      ["Why count ready contacts before setting the target?", "Because the target is only real if you can send it. 6 of 15 ready means 10 a week needs 4 more contacts made ready first, which is this week's Do step."],
      ["What if 10 a week is too many?", "Then pick a number you will hit and write it down. A kept 5 beats a missed 10; raise it when you have two weeks of hits."],
      ["Which tools are open to me?", "Outreach: Manual, matches and social are open from the start. Automated outreach opens when your rating clears the gate; the IR Agent when it is enabled for your account."],
    ],
    stuckHelp: "Open Stage 1 Onboarding › My Progress and read which tools are open. Then Stage 3 Marketing › My contacts: add an email or a note to the contacts missing one. Four of them gets you to ten.",
  },
  {
    lessonSlug: "matches-introductions",
    week: 2,
    shortTitle: "Matches and intros",
    minutes: 14,
    intro: "Week 2. First, two questions on last week, then I check the task you committed to.",
    readScreen: MATCHES,
    readNote: "On the right is Investor matches, with the reason each investor was suggested and what happened to your earlier requests.",
    case: {
      title: "Pre-seed fintech, raising $600K",
      setup: "Marcus requested introductions to all twelve of his matches in one evening. Nine were dismissed within a week.",
      lines: [
        "He reads the match reason for each. Four of twelve share his stage and sector; the other eight do not.",
        "He requests three introductions, one line each on why the fit is real, and notes the date in Tasks.",
        "Two of the three are facilitated. The difference was the reading, not the number.",
      ],
      rule: "Read why each investor matched, request only where the fit is real, and note the date in Tasks.",
    },
    companyQuestion: "Look at what happened to your earlier requests on the right. Before you request the next three, what would you do differently?",
    companyOptions: [
      { label: "Read the match reason first and request only where it fits", reply: "That is the lesson. Dismissed requests are a fit problem before they are a volume problem." },
      { label: "Request more, to improve the odds", reply: "More of the same gets more of the same. Dismissals say the fit was off, not the volume." },
      { label: "Stop requesting and go cold instead", reply: "Matches are still the shortest list of investors whose focus fits you. Fix the selection, do not abandon the list." },
    ],
    companyFollowUp: "Name one match you would request today, and the one line reason.",
    companyFollowUpReply: "That is a request an investor can say yes to. Investor matches is on the right.",
    doScreen: MATCHES,
    doMetric: "intro_requests",
    doIntro: "Request three introductions on the right, each after reading the reason. I count requests this week.",
    doTarget: 3,
    doVerb: "Request intro",
    doDone: "Three requested, each with a reason. Three questions, then your commitment.",
    recall: [
      { prompt: "Recall 1 of 2. What two things does a contact need before you message them?", options: ["An email and a short note", "A LinkedIn profile and a photo", "A deck sent and a reply"], rightIndex: 0 },
      { prompt: "Recall 2 of 2. What do you check before using an outreach tool?", options: ["Whether it is open at your stage", "Whether it is free", "Whether investors prefer it"], rightIndex: 0 },
    ],
    tests: [
      { prompt: "Before you request an introduction, what should you have read?", options: ["The reason the investor was matched to you", "The investor's full portfolio", "Your own pitch deck again"], rightIndex: 0, why: "The lesson's common mistake is contacting every match." },
      { prompt: "How many introductions does the lesson example suggest per week, and where does the date go?", options: ["Three, noted in Tasks", "Ten, noted in Calendar", "As many as the plan allows"], rightIndex: 0, why: "Three is a number you can count, and the date in Tasks is what next week's check reads." },
      { prompt: "A dismissed request counts as what?", options: ["Not an introduction", "A pending introduction", "A warm contact"], rightIndex: 0, why: "Only a facilitated request is an introduction. Dismissed means the fit was not there." },
    ],
    commitHint: "request three fitted introductions with a reason each",
    commitDone: "Saved. Next week I open by reading your request count and what happened to them.",
    faq: [
      ["Why were my requests dismissed?", "I can see the status, not the reason. Dismissed in bulk usually means the fit was off: stage, sector or check size. Read the match reason before the next three."],
      ["How many requests should I send?", "Three this week, each with one line on why the fit is real. The plan cap is on the matches page; three fitted beats the cap unfitted."],
      ["Can I message the investor directly instead?", "Introductions are brokered through iCFO so the investor sees a vetted request. A fitted request is the shortest route."],
    ],
    stuckHelp: "Open Stage 3 Marketing › Investor matches, read the reason on each card, and press Request introduction on three whose stage and sector fit. One line each on why.",
  },
  {
    lessonSlug: "manual-outreach",
    week: 3,
    shortTitle: "Manual outreach",
    minutes: 17,
    intro: "Week 3. Two recall questions, then the commitment check, then the lesson that sends the batch.",
    readScreen: OUTREACH,
    readNote: "On the right is Outreach: Manual. The AI drafts, you review and send, and I count sends and follow ups.",
    case: {
      title: "Seed stage B2B SaaS, raising $1.2M",
      setup: "Tomás sent 10 first messages in week 1 and got one reply. He assumed the other nine were a no.",
      lines: [
        "He opens Tasks and finds no follow up dates. Nine messages with no second touch is where most replies are lost.",
        "He adds a follow up for each, 5 business days after the first message, with one new fact: a pilot signed.",
        "By Friday: 9 follow ups sent, 2 more replies. Both came from the follow ups, not the first messages.",
      ],
      rule: "Lead with why this investor in two sentences, and follow up 5 business days later with one new fact.",
    },
    companyQuestion: "Look at your sends and replies on the right. Which step will produce replies this week?",
    companyOptions: [
      { label: "Follow ups with one new fact", reply: "That is where most replies come from. A follow up with nothing new is a nudge; one new fact gives the investor a reason to answer." },
      { label: "A longer first message", reply: "The lesson's common mistake. Lead with why this investor in two sentences; the rest can wait for the reply." },
      { label: "Sending to more people", reply: "Volume without a follow up loses the replies you already paid for. Follow up first, then widen." },
    ],
    companyFollowUp: "What is the one new fact your follow up will carry?",
    companyFollowUpReply: "That is a reason to reply. Outreach is on the right; send, then schedule the follow ups.",
    doScreen: OUTREACH,
    doMetric: "sends",
    doIntro: "Send your first messages from Outreach: Manual on the right. I count sends this week.",
    doTarget: 5,
    doVerb: "Send",
    doDone: "The batch is out. Three questions, then your commitment.",
    recall: [
      { prompt: "Recall 1 of 2. What do you read before requesting an introduction?", options: ["The reason the investor matched", "The investor's LinkedIn", "Nothing, just request"], rightIndex: 0 },
      { prompt: "Recall 2 of 2. A dismissed request counts as what?", options: ["Not an introduction", "A pending introduction", "A warm contact"], rightIndex: 0 },
    ],
    tests: [
      { prompt: "When should a follow up go out, and what should it contain?", options: ["5 business days after the first message, with one new fact", "The next day, repeating the first message", "Only if the investor opened the deck"], rightIndex: 0, why: "A follow up with nothing new is a nudge. One new fact gives a reason to reply." },
      { prompt: "What do the first two sentences of a message do?", options: ["Say why this investor", "Introduce the team", "Explain the product"], rightIndex: 0, why: "The common mistake is a long generic message." },
      { prompt: "Where does each follow up date live?", options: ["In Tasks", "In your head", "In the email draft"], rightIndex: 0, why: "What is not on Tasks usually does not happen, and it is what next week's check reads." },
    ],
    commitHint: "send a follow up with one new fact to everyone I messaged",
    commitDone: "Saved. Next week I open with your follow up count.",
    faq: [
      ["What goes in the first two sentences?", "Why this investor: the sector or stage they back and the one thing about you that fits it. The AI drafts it from your contact note; you review and send."],
      ["When do I follow up?", "5 business days after the first message, with one new fact. That is where most replies come from."],
      ["What counts as a send?", "A message that went out from Outreach: Manual. Opens can be automatic, so I count sends and replies, not opens."],
    ],
    stuckHelp: "Open Stage 3 Marketing › Outreach, choose the Outreach: Manual tab, pick your ready contacts, let the AI draft, review each, send. Then Tasks: a follow up per message, 5 business days out.",
  },
  {
    lessonSlug: "social-media",
    week: 4,
    shortTitle: "Social media",
    minutes: 12,
    intro: "Week 4. Two recall questions first, then the commitment check.",
    readScreen: SOCIAL,
    readNote: "On the right is Social media: your connected accounts and your plan's monthly post limit.",
    case: {
      title: "Seed stage climate hardware, raising $2M",
      setup: "Lena has 1,100 LinkedIn followers and has not posted in four months. Her plan allows 8 posts a month.",
      lines: [
        "She connects LinkedIn only. Two accounts would double the work, and she has one hour a week for this.",
        "She lists real milestones from the last quarter: a pilot signed, a hire, a grant. One fact per post, no mention of the raise.",
        "She schedules Tuesday mornings, 4 posts for the month, half her limit, so the habit survives a bad week.",
      ],
      rule: "One account, one real milestone per post, on a schedule you can keep.",
    },
    companyQuestion: "What is one milestone from the last 60 days you could post about, stated as a fact with a number?",
    companyOptions: [
      { label: "A customer or pilot signed, with the number", reply: "That is a post. A fact with a number, no promise attached." },
      { label: "We are about to raise, stay tuned", reply: "That is the common mistake: hype and a raise outcome. Investors scroll past it." },
      { label: "I do not have a milestone yet", reply: "Then the post is the next small one: a hire, a demo, a user count. Pick the nearest fact." },
    ],
    companyFollowUp: "Which day and time will the post go out each week?",
    companyFollowUpReply: "A day you can keep beats a day that looks good. Social media is on the right.",
    doScreen: SOCIAL,
    doMetric: "social",
    doIntro: "Connect one account and schedule this week's post on the right. I count connected accounts and scheduled posts.",
    doTarget: 2,
    doVerb: "Set up",
    doDone: "Account connected and a post scheduled. Three questions, then your commitment.",
    recall: [
      { prompt: "Recall 1 of 2. How many days after a first message does a follow up go out?", options: ["5 business days", "1 day", "30 days"], rightIndex: 0 },
      { prompt: "Recall 2 of 2. What does a follow up message contain?", options: ["One new fact", "The same message again", "A reminder of the ask"], rightIndex: 0 },
    ],
    tests: [
      { prompt: "What is the investor update angle for a post?", options: ["Progress, not hype: one real milestone as a fact", "A teaser that big news is coming", "An ask for investors to get in touch"], rightIndex: 0, why: "The lesson's common mistake is promising returns or a raise outcome." },
      { prompt: "Why connect only one account first?", options: ["A rhythm you can sustain matters more than reach", "One account is free on every plan", "Investors only use LinkedIn"], rightIndex: 0, why: "The lesson says aim for a rhythm you can keep." },
      { prompt: "Which post follows the lesson?", options: ["We signed our first paid pilot this month", "We are raising $2M, DM me", "Big news coming soon"], rightIndex: 0, why: "It is a fact about the company with no promise attached." },
    ],
    commitHint: "publish one post about a real milestone",
    commitDone: "Saved. Next week I check whether the post went out.",
    faq: [
      ["Which account first?", "The one your investors read. For B2B, LinkedIn. One account, a rhythm you can keep."],
      ["What if I have nothing to post?", "A fact with a number: a pilot, a hire, a user count. Progress, not hype, and never a raise outcome."],
      ["How many posts a month?", "Half your plan limit until the habit holds. Four posts you publish beat eight you schedule and miss."],
    ],
    stuckHelp: "Open Stage 3 Marketing › Social media, connect one account, then write one post about a real milestone and schedule it for a day you can keep.",
  },
  {
    lessonSlug: "automated-outreach",
    week: 5,
    shortTitle: "Automated outreach",
    minutes: 12,
    intro: "Week 5 runs when automated outreach unlocks for you. If it is still locked, this module reads as a preview and you keep sending manually.",
    readScreen: OUTREACH,
    readNote: "On the right is Outreach: Automated, with your gate status read from your Capital Readiness Rating.",
    case: {
      title: "Seed stage B2B SaaS, raising $1.2M",
      setup: "Tomás clears the gate in week 5. Outreach shows a ranked list of 40 contacts ready to send.",
      lines: [
        "He reads the gate status first: open. He checks what the automation will send and to whom before touching approve.",
        "He approves 12 of the 40, the ones he would have written to himself. The other 28 stay unapproved.",
        "He sets a daily reply check in Tasks, because an automated send with nobody reading replies is noise.",
      ],
      rule: "Approve only the contacts you would write to yourself, and read replies daily.",
    },
    companyQuestion: "If the ranked list shows 40 contacts, how will you decide which ones to approve?",
    companyOptions: [
      { label: "Only the ones I would write to myself", reply: "That is the filter. Ranked is not the same as right." },
      { label: "The top 20 by rank", reply: "Rank is a model's guess. Twenty you would not write to yourself is twenty generic sends." },
      { label: "All 40, it is automated", reply: "Automated sends still carry your name. Review before anything sends is the lesson." },
    ],
    companyFollowUp: "What time each day will you read replies?",
    companyFollowUpReply: "Put that in Tasks before the first send. Outreach is on the right.",
    doScreen: OUTREACH,
    doMetric: "automated",
    doIntro: "Check your gate status on the right. If it is open, approve only the contacts that pass your filter.",
    doTarget: 1,
    doVerb: "Check gate",
    doDone: "Gate checked. Three questions, then your commitment.",
    recall: [
      { prompt: "Recall 1 of 2. What angle does a social post take?", options: ["Progress, not hype", "A countdown to the raise", "A request for intros"], rightIndex: 0 },
      { prompt: "Recall 2 of 2. How many accounts did the lesson say to connect first?", options: ["One", "All of them", "Two"], rightIndex: 0 },
    ],
    tests: [
      { prompt: "What opens automated outreach?", options: ["Your Capital Readiness Rating clearing the outreach gate", "Importing 50 or more contacts", "Finishing module 5"], rightIndex: 0, why: "Until then, manual outreach is the tool." },
      { prompt: "What is the filter for approving a contact?", options: ["Only the ones you would write to yourself", "The top 20 by rank", "Everyone in your sector"], rightIndex: 0, why: "Ranked is not the same as right." },
      { prompt: "A reply arrives from an automated send. What happens next?", options: ["You read and answer it", "Nothing, the system handles it", "Wait for the next batch"], rightIndex: 0, why: "The lesson says watch replies and act on them. AI drafts, you confirm." },
    ],
    commitHint: "read and answer outreach replies every morning",
    commitDone: "Saved. Next week I check your reply handling.",
    faq: [
      ["Why is it locked for me?", "Your Capital Readiness Rating is under the outreach gate of 65. The fix list on your rating page names the items that move it most."],
      ["What do I approve?", "Only the contacts you would write to yourself. Ranked is not the same as right."],
      ["Who answers replies?", "You do. The AI drafts; you confirm. A daily reply check in Tasks is the habit."],
    ],
    stuckHelp: "Open Stage 3 Marketing › Outreach, choose Outreach: Automated and read the gate status. If open, approve only the contacts you would write to yourself.",
  },
  {
    lessonSlug: "ir-agent",
    week: 6,
    shortTitle: "IR Agent",
    minutes: 12,
    intro: "Week 6, when your IR Agent is available. Two recall questions, then the commitment check.",
    readScreen: IR_AGENT,
    readNote: "On the right is My IR Agent: how it introduces your company today, and its conversations.",
    case: {
      title: "Series A prep, marketplace, raising $4M",
      setup: "Ana turns on the IR Agent with the default introduction text still in place.",
      lines: [
        "First conversation review: the agent describes her as pre-seed. She is two years past that. She rewrites the introduction with her real stage, sector and what the round funds.",
        "She adds three facts the agent may state and two it may not: no revenue figures, no valuation.",
        "She reviews every conversation for a week and corrects two answers. The agent books one call; she confirms it herself.",
      ],
      rule: "Rewrite the introduction with your real stage, sector and use of funds, then review every conversation before confirming anything.",
    },
    companyQuestion: "In one sentence, how should the agent introduce your company: stage, sector, and what the raise funds?",
    companyOptions: [
      { label: "Stage, sector and what the raise funds, in my words", reply: "That is the introduction. Put it in on the right." },
      { label: "Keep the default text for now", reply: "The default text is the common mistake. It will describe you wrong to the first prospect it talks to." },
      { label: "Revenue and valuation too", reply: "Leave those out. Set what the agent must not say, and keep numbers for the meeting you confirm yourself." },
    ],
    companyFollowUp: "What must the agent never say about your company?",
    companyFollowUpReply: "Set that limit before it talks to anyone. My IR Agent is on the right.",
    doScreen: IR_AGENT,
    doMetric: "ir_agent",
    doIntro: "Rewrite the introduction and set the limits on the right. I check whether the agent is live.",
    doTarget: 1,
    doVerb: "Save",
    doDone: "Introduction set. Three questions, then your commitment.",
    recall: [
      { prompt: "Recall 1 of 2. What is the filter for approving an automated contact?", options: ["Would I write to them myself", "Rank above 50", "Same city"], rightIndex: 0 },
      { prompt: "Recall 2 of 2. What opens automated outreach?", options: ["Clearing the outreach gate", "Module 5", "A paid plan"], rightIndex: 0 },
    ],
    tests: [
      { prompt: "What three things belong in the agent's introduction?", options: ["Your real stage, sector and what you are raising for", "Your valuation, revenue and runway", "Your team size, office and founding date"], rightIndex: 0, why: "The common mistake is leaving the default text." },
      { prompt: "Who confirms a meeting the agent books?", options: ["You do", "The agent does", "The investor does"], rightIndex: 0, why: "AI drafts and books, the founder confirms." },
      { prompt: "How often should you review the agent's conversations in the first week?", options: ["Every conversation", "Once at the end of the week", "Only if a meeting is booked"], rightIndex: 0, why: "Corrections in week one shape everything the agent says after." },
    ],
    commitHint: "review every IR Agent conversation and confirm meetings myself",
    commitDone: "Saved. Next week I check your review count.",
    faq: [
      ["What should the agent say first?", "Your real stage, sector and what the raise funds, in your words. The default text is the common mistake."],
      ["What must it never say?", "Revenue figures and valuation unless you set them. Set the limits before it talks to anyone."],
      ["Who confirms a meeting?", "You do, every time. The agent books; you confirm."],
    ],
    stuckHelp: "Open Stage 3 Marketing › My IR Agent, rewrite the introduction with your stage, sector and use of funds, and set what it must not say.",
  },
  {
    lessonSlug: "events",
    week: 7,
    shortTitle: "Events",
    minutes: 12,
    intro: "Week 7. Two recall questions, then the commitment check.",
    readScreen: EVENTS,
    readNote: "On the right is Present at event: the events you can present at.",
    case: {
      title: "Seed stage edtech, raising $900K",
      setup: "David has three events on offer. Two are growth stage showcases; one is a seed investor evening.",
      lines: [
        "He picks the seed evening only. The other two put him in front of investors who write cheques three sizes larger than his round.",
        "He writes a 60 second pitch with one ask: two seed investors who know education sales cycles.",
        "He blocks the event and a follow up block two days later on Calendar before the event, not after.",
      ],
      rule: "One stage matched event, one 60 second pitch with one ask, follow up blocked on Calendar in advance.",
    },
    companyQuestion: "What is your one ask, in one sentence, for the next event you attend?",
    companyOptions: [
      { label: "Two seed investors who know my sector", reply: "One ask, specific enough to act on. That is the pitch's last line." },
      { label: "Anyone interested in investing", reply: "Too wide to act on. An investor cannot help with anyone. Name the stage and the sector." },
      { label: "Feedback on my deck", reply: "Fair for a first event, but it is not a raise ask. Pair it with who you want to meet." },
    ],
    companyFollowUp: "Which event, and what date is the follow up block?",
    companyFollowUpReply: "Block the follow up now, before the event. Present at event is on the right.",
    doScreen: EVENTS,
    doMetric: "events",
    doIntro: "Pick one event on the right and put it and a follow up block on Calendar.",
    doTarget: 1,
    doVerb: "Pick event",
    doDone: "Event picked and follow up blocked. Three questions, then your commitment.",
    recall: [
      { prompt: "Recall 1 of 2. What must the IR Agent introduction include?", options: ["Stage, sector and what you are raising for", "Revenue and valuation", "Founder bios"], rightIndex: 0 },
      { prompt: "Recall 2 of 2. Who confirms a meeting the agent books?", options: ["You do", "The agent", "The investor"], rightIndex: 0 },
    ],
    tests: [
      { prompt: "How long is the pitch, and how many asks does it carry?", options: ["60 seconds, one clear ask", "Five minutes, three asks", "As long as they will listen"], rightIndex: 0, why: "Short pitch, single ask, so the listener knows what to do." },
      { prompt: "Within how many days do you follow up after an event?", options: ["Two", "Seven", "Fourteen"], rightIndex: 0, why: "The lesson sets two days; the case blocks it on Calendar in advance." },
      { prompt: "Which event do you pick?", options: ["The one matching your stage", "The biggest one", "All of them"], rightIndex: 0, why: "Stage fit decides whether the conversations can lead anywhere." },
    ],
    commitHint: "send every event follow up within two days",
    commitDone: "Saved. Next week I check your follow ups against the event date.",
    faq: [
      ["Which event?", "The one matching your stage. A seed evening beats a growth showcase, however big the room."],
      ["What is the one ask?", "One sentence naming the stage and the sector: two seed investors who know your market."],
      ["When do I follow up?", "Within two days. Block it on Calendar before the event, not after."],
    ],
    stuckHelp: "Open Stage 3 Marketing › Present at event, pick the one that matches your stage, then Workspace › Calendar: the event and a follow up block two days after.",
  },
  {
    lessonSlug: "plan-goals",
    week: 8,
    shortTitle: "Plan and goals",
    minutes: 12,
    intro: "Week 8. Two recall questions, then the commitment check. After this week, this module repeats every Monday as your five minute review.",
    readScreen: TASKS,
    readNote: "On the right is Tasks: every outreach action with a date, or the gap where one should be.",
    case: {
      title: "Priya, week 8 review",
      setup: "Seven weeks in: 20 sent, 13 follow ups, 6 replies, 3 meetings. Her runway decision is next week.",
      lines: [
        "She reviews inputs first: sends and follow ups hit target in 5 of 7 weeks. The two misses were the weeks with no Calendar block.",
        "She keeps the target and adds the block. The habit, not the number, was the problem.",
        "Next week in Tasks: 10 sends, 8 follow ups, one event follow up. Every line has a date. The review took 15 minutes.",
      ],
      rule: "Review inputs weekly, fix the habit that missed, and put every next action in Tasks with a date.",
    },
    companyQuestion: "Looking at your weeks of inputs, which week missed, and what was different about it?",
    companyOptions: [
      { label: "The weeks with no Calendar block missed", reply: "Then the fix is the block, not the target. That is the lesson in one line." },
      { label: "The target was too high", reply: "Maybe, but check the habit first. If the missed weeks had no block, the number was not the problem." },
      { label: "Nothing missed", reply: "Then the review is short: keep the numbers, book next week, done in five minutes." },
    ],
    companyFollowUp: "What is the one habit change for next week?",
    companyFollowUpReply: "That goes in Tasks with a date, on the right.",
    doScreen: TASKS,
    doMetric: "tasks",
    doIntro: "List next week's outreach actions in Tasks with due dates, on the right. I count open outreach tasks.",
    doTarget: 3,
    doVerb: "Add task",
    doDone: "Next week is planned with dates. Three questions, then your commitment.",
    recall: [
      { prompt: "Recall 1 of 2. What is the follow up window after an event?", options: ["Two days", "One week", "One month"], rightIndex: 0 },
      { prompt: "Recall 2 of 2. How many asks does the 60 second pitch carry?", options: ["One", "Three", "As many as fit"], rightIndex: 0 },
    ],
    tests: [
      { prompt: "What do you review first each week?", options: ["Inputs: sends, follow ups, requests", "Replies and meetings", "Your readiness score"], rightIndex: 0, why: "Replies and meetings are tracked, not graded. Inputs are what you control." },
      { prompt: "When a week misses, what do you change?", options: ["The habit, not the target", "The target, down", "The whole plan"], rightIndex: 0, why: "The lesson: adjust the target, not the habit." },
      { prompt: "Where does next week's plan live?", options: ["In Tasks and Calendar with dates", "In your head", "In a note"], rightIndex: 0, why: "What is not on Tasks and Calendar usually does not happen." },
    ],
    commitHint: "run my 15 minute outreach review every Monday at 9am",
    commitDone: "Saved. From here the review repeats weekly, and I open each one with your numbers.",
    faq: [
      ["What do I review first?", "Inputs: sends, follow ups, requests. The actions you control. Replies and meetings are tracked, not graded."],
      ["What if a week missed?", "Change the habit, not the target. The weeks that miss are usually the ones with no Calendar block."],
      ["How long is the review?", "Fifteen minutes on Monday. Numbers, one fix, next week in Tasks with dates."],
    ],
    stuckHelp: "Open Workspace › Tasks and list next week's outreach actions with due dates. Then Workspace › Calendar: one weekly outreach block you will protect.",
  },
];

export const MONDAY_REVIEW_SLUG = "monday-review";

/** The weekly review after module 8: recall, your numbers, one question, one commitment. */
export const MONDAY_REVIEW = {
  lessonSlug: MONDAY_REVIEW_SLUG,
  shortTitle: "Monday review",
  minutes: 5,
  intro: "Monday review, five minutes. Two recall questions, then your numbers against last week, then one commitment.",
  recall: PROGRAM_MODULES[7].tests.slice(0, 2).map((t) => ({ prompt: t.prompt, options: t.options, rightIndex: t.rightIndex })),
  companyQuestion: "What got in the way last week? One sentence, the honest one.",
  companyOptions: [
    { label: "No time blocked for it", reply: "That is the most common one, and it has the simplest fix: a block on Calendar." },
    { label: "I was not sure what to send", reply: "Then the commitment is the draft, not the send. The AI drafts, you review, three messages." },
    { label: "Waiting on contacts or replies", reply: "Waiting is a decision too. What can go out this week without the thing you are waiting for?" },
  ] as ProgramChoice[],
  companyFollowUp: "And what is the one thing that would have made it happen?",
  companyFollowUpReply: "Good. That goes in the commitment.",
  commitHint: "block Tuesday 9 to 10 for outreach and send the first five",
  commitDone: "Next Monday I open with whether this one was met.",
};

/** The outreach program as one definition; PROGRAM_MODULES and the other exports above remain its parts. */
export const OUTREACH_PROGRAM: ProgramDefinition = {
  courseSlug: "investor-outreach-playbook",
  title: "Investor Outreach Playbook",
  modules: PROGRAM_MODULES,
  review: MONDAY_REVIEW as ProgramReview,
  benchmarks: [],
  sources: [],
};

export function getProgramModule(lessonSlug: string, program: ProgramDefinition = OUTREACH_PROGRAM): ProgramModule | null {
  return program.modules.find((m) => m.lessonSlug === lessonSlug) ?? null;
}

export type EncouragementKey = "read" | "company" | "why" | "done" | "test3" | "test2" | "test1" | "commit" | "recall2" | "recall1" | "recall0";

/**
 * Coach lines at the points where the founder just did something. Keyed by the three styles in
 * tones.ts: encouraging (warm), driven (direct), relentless (short, holds the line). None shames.
 */
export const ENCOURAGEMENT: Record<CoachTone, Record<EncouragementKey, string>> = {
  encouraging: {
    read: "Nice work getting through that. You now know more than most founders do when they start sending.",
    company: "That is a thoughtful answer, and it is one you can count every week.",
    why: "Good reasoning, and it fits your numbers.",
    done: "Well done, that is real progress, built from your own data. The test is two minutes.",
    test3: "Three of three, excellent. You have the ideas; the doing is the next win.",
    test2: "Two of three, good. The one you missed is worth a second look because it is where replies come from.",
    test1: "One of three, and that is fine for a first pass. Reread the two lines on the right; what matters most is the action this week.",
    commit: "Saved, and that is the hardest part done. A dated task keeps this real. Reminder set for",
    recall2: "Two of two from last week. It stuck.",
    recall1: "One of two. The other one is in the lesson you just did; it will come back next week.",
    recall0: "Neither one yet, and that is why we ask. Both are in last week's lesson; today's work will make them stick.",
  },
  driven: {
    read: "Good. That is the whole lesson in three lines.",
    company: "That is a plan you can count. Most founders skip this and lose a week.",
    why: "That is the right call for your numbers.",
    done: "Done. That is a real step. Two minutes to the test.",
    test3: "Three of three. You know this; now the only thing that counts is the doing.",
    test2: "Two of three. The one you missed is the one that costs founders replies, so it is worth the reread.",
    test1: "One of three. Reread the two lines on the right and we go again next week; the doing matters more than the score.",
    commit: "Saved. A dated task is the difference between a plan and a wish. Reminder set for",
    recall2: "Two of two. Kept.",
    recall1: "One of two. Read the one you missed again before you start.",
    recall0: "Zero of two. Last week's lesson did not stick; read its three lines again, then start.",
  },
  relentless: {
    read: "Read. Now do.",
    company: "Countable. Good. Hold yourself to it.",
    why: "Right call. Move.",
    done: "Done is what counts. Test, two minutes, then commit.",
    test3: "Three of three. Knowing is not doing. Send.",
    test2: "Two of three. Fix the one you missed before you send.",
    test1: "One of three. Reread the two lines on the right, now, then send this week anyway.",
    commit: "Saved. I check this at the time you chose. Reminder set for",
    recall2: "Two of two. Next.",
    recall1: "One of two. Reread the missed one. Then start.",
    recall0: "Zero of two. Reread last week's three lines before you touch anything else.",
  },
};

export function encouragement(tone: CoachTone, key: EncouragementKey): string {
  return ENCOURAGEMENT[tone][key];
}

export function testEncouragement(tone: CoachTone, correct: number): string {
  return encouragement(tone, correct >= 3 ? "test3" : correct === 2 ? "test2" : "test1");
}

export function recallEncouragement(tone: CoachTone, correct: number): string {
  return encouragement(tone, correct >= 2 ? "recall2" : correct === 1 ? "recall1" : "recall0");
}

/**
 * Published benchmarks for the "where you stand" panel. Every figure names its source and population.
 * Lines marked estimate are derived from those sources and say so; an iCapOS industry median replaces
 * them once enough founders in the same industry have run the playbook (see program-reads).
 */
export const PROGRAM_BENCHMARKS: Array<{ key: string; label: string; lessonTarget: string; stage: string; industry: string }> = [
  { key: "lessons", label: "Playbook modules completed", lessonTarget: "One module a week", stage: "No published benchmark", industry: "No published benchmark" },
  { key: "contacts_ready", label: "Contacts ready (email and note)", lessonTarget: "10, from the lesson example", stage: "66 investors contacted per seed raise on average, 2023 (DocSend, n=170)", industry: "SaaS founders: half meet 11 to 50 investors, a third fewer than 10 (High Alpha 2026 SaaS survey, n not stated). Estimate: 50 to 60 contacted per raise." },
  { key: "sends_week", label: "First messages sent this week", lessonTarget: "10 a week, from the lesson example", stage: "No weekly figure published. 66 per raise over about 8 active weeks is 8 a week (derived)", industry: "Estimate: 6 to 8 a week in active outreach for SaaS (50 to 60 contacted over 8 weeks). A target of 10 is above the typical pace." },
  { key: "intro_requests", label: "Introduction requests and response", lessonTarget: "3 a week, from lesson 2", stage: "Investors respond to 31% of intro requests at seed, 36% at pre-seed, all sectors (Metal, sample not stated)", industry: "Metal: B2B software about double fintech, no figure given. Estimate: 35% to 40% for SaaS / B2B at seed, 18% to 20% for fintech." },
  { key: "follow_ups", label: "Follow ups sent this week", lessonTarget: "5 a week, from the lesson example", stage: "30% to 50% of replies come from the second touch on; 3 to 5 touches, 3 to 5 business days apart (AngelsPartners 2026, sample not stated)", industry: "No sector data. Estimate: same as all sectors." },
  { key: "replies", label: "Replies", lessonTarget: "Tracked, not graded", stage: "Personalised cold email 8% to 20%, generic 3% to 8%, warm intro 40% to 70% (AngelsPartners 2026, sample not stated)", industry: "No sector figure. Estimate: upper half of the range for SaaS / B2B, 12% to 20%, because B2B software draws the most investor attention (Metal)." },
  { key: "meetings", label: "Investor meetings", lessonTarget: "Tracked, not graded", stage: "38 meetings per seed raise, 2023 (DocSend, n=170)", industry: "SaaS: half of founders meet 11 to 50 investors (High Alpha 2026). Estimate: 25 to 40 meetings per SaaS seed raise." },
];

export const PROGRAM_BENCHMARK_SOURCES = [
  "DocSend 2023 seed report, 170 seed stage decks, H2 2022 to H1 2023.",
  "Metal intro response benchmark, thousands of introduction requests, sample size and period not stated.",
  "AngelsPartners 2026 investor outreach benchmark report, ranges with no stated sample.",
  "High Alpha, SaaS fundraising in 2026, early stage B2B SaaS founders, respondent count not stated.",
];

/** How many founders in the same industry must have four weeks of playbook data before their median replaces the estimates. */
export const INDUSTRY_MEDIAN_MIN_FOUNDERS = 10;

OUTREACH_PROGRAM.benchmarks = PROGRAM_BENCHMARKS;
OUTREACH_PROGRAM.sources = PROGRAM_BENCHMARK_SOURCES;
