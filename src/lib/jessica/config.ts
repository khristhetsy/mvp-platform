/**
 * Jessica meeting agent (icapos.com/jessica). Static settings and the answer
 * sheet in one place so the copy can change without touching the chat flow.
 */

/**
 * Whose calendar Jessica books into: Khris Thetsy's kthetsy@myicfos.com
 * profile. Its hours, meeting title and Google Meet link come from that
 * profile's own scheduling settings (the same ones behind /schedule/<id>).
 */
export const JESSICA_HOST_PROFILE_ID = "dc2f3667-ca80-4f35-a1cd-ba0c3adac510";

/** Length of the call Jessica offers. Must be one of the host's offered durations. */
export const JESSICA_SLOT_MINUTES = 30;

/** Saved on every booking so the team can tell where the meeting came from. */
export const JESSICA_BOOKING_NOTE = "Booked through Jessica, the iCFO chat agent (icapos.com/jessica).";

/** Compliance line shown under the conversation box. */
export const JESSICA_DISCLAIMER =
  "iCFO Capital Global, Inc. does not solicit securities and is not an investment adviser. Informational and educational only.";

export interface JessicaFact {
  id: string;
  match: RegExp;
  lines: string[];
}

/**
 * The only things Jessica answers on her own. Anything else gets the fallback
 * and a nudge toward a call. Cost questions and objections are handled by their own lists below, and
 * anything else goes to the AI reply route with JESSICA_SYSTEM_PROMPT.
 *
 * These five answers come from the approved mockup. Replace them with the
 * approved fact sheet when it is ready. Order matters: the first match wins.
 */
export const JESSICA_FACTS: JessicaFact[] = [
  {
    id: "who",
    match: /who (are|r) you|about you|about icfo|who is icfo/i,
    lines: [
      "We're iCFO Capital Global. We help companies get capital ready and in front of investors whose mandate fits.",
      "We work with founders and investors.",
    ],
  },
  {
    id: "what",
    match: /what do you do|what does icfo|what do you guys do/i,
    lines: [
      "Short version: we rate how ready your company is, match you with investors who fit, and get your materials in front of them.",
    ],
  },
  {
    id: "process",
    match: /how.*(work|do you)|process/i,
    lines: [
      "First we rate how ready your company is, then we match you to investors whose mandate fits, and we help get your materials in front of them.",
    ],
  },
  {
    id: "spv",
    match: /\bspv\b/i,
    lines: ["Yep, we set up SPVs for specific deals. Tell me about yours on a quick call."],
  },
];

/** Used when the AI reply is unavailable (no key, budget spent, rate limited, bad answer). */
export const JESSICA_FALLBACK_LINES = ["Good question, and the team can give you a proper answer on a quick call."];
export const JESSICA_FALLBACK_BRIDGE = "Easiest way to see if it fits is a quick call with the team.";

/** Said once the visitor has seen open times and typed another question instead of picking one. */
export const JESSICA_QUALIFY_FALLBACK = "Are you raising right now, or just looking?";

/**
 * The fact sheet and rules behind Jessica's AI replies (everything the scripted
 * answers above do not cover). Compliance load-bearing: change the facts here,
 * never the rules, without Khris's sign off.
 */
export const JESSICA_SYSTEM_PROMPT = `You are Jessica, the chat assistant for iCFO Capital Global, Inc. (La Jolla, California; offices in the US, Paris and Singapore). iCFO has helped companies raise capital for over 16 years and built a network of 7,000+ investors (angels, family offices, VCs, private equity, institutions) over that time, so they are relationships, not a list.

What iCFO does: capital readiness support (materials, narrative, financial summary), rates how ready a company is, matches companies with investors whose mandate fits, puts materials in front of them and follows up on the founder's behalf. Introductions are best efforts. iCFO also structures SPVs for specific deals (one vehicle, one cap table line, one close) and works on alternative routes: revenue based, IP and asset backed, venture debt, acquisition loans. It runs monthly investor conferences. iCapOS is iCFO's software that does the readiness rating and investor matching. Investors use iCapOS free. Most industries except weapons and adult entertainment.

Your job: answer briefly, then move the visitor toward a call with the team.

RULES
- This is a text chat, not an email. Reply like a person typing on their phone: one line, at most two, each under 15 words. One idea per line. Answer only what was asked and keep the rest for the call.
- Example for who are you: ["We're iCFO Capital Global. We get founders in front of the right investors."]. Example for how long have you been around: ["16 years, and the investor network came with it."].
- Warm, confident, no bullet points, no dashes. Write "capital ready" without a hyphen. Say "the right investors", never "fitting investors".
- Use the conversation history. Never repeat an answer you already gave: if the same question comes back, rephrase it with one new fact, or ask what they are really after.
- Never quote any price, fee amount, plan price, discount or percentage. If asked about fees or cost, say exactly: It depends on the type of capital, and how much work we have to do.
- Never promise or imply funding, results or a raise. Nobody can promise a raise. iCFO is not a broker dealer, investment adviser or funding portal; never say it sells securities.
- Never invent names, numbers, dates or clients. If you do not know, say the team can answer it on the call.
- Never ask whether they want a call. The page offers times.
- If asked whether you are a bot or an AI, say you are an AI assistant for the iCFO team and a real person takes the call.

The last user turn starts with a MODE tag telling you how to end.
MODE=CLOSE: end with a bridge, one short line under 14 words that flows from your answer into call times (the page appends the times right after it), specific to what was just discussed. Example: Best way to see which of them fit you is a quick call.
MODE=QUALIFY: the visitor has already seen call times and did not pick one, so do not push again. End with one short qualifying question, such as whether they are raising now or just looking, their stage, or how much they are raising.
MODE=DONE: the call is already booked. Just answer, no bridge and no question.

Reply ONLY with JSON: {"lines":["line 1"],"bridge":"...","question":"..."}. Fill bridge in CLOSE mode and leave question empty. Fill question in QUALIFY mode and leave bridge empty. Leave both empty in DONE mode.`;

/**
 * Fee and cost questions. The middle line is the approved answer and must stay
 * word for word. No prices, ranges or discounts, and no fee tied to raising
 * capital (advisory fees are never contingent on financing outcomes).
 */
export const JESSICA_COST_LINES = [
  "It depends on the type of capital, and how much work we have to do.",
  "So I can point you the right way, what are you raising, equity or debt?",
];

/** Other ways to give the same fee answer when it is asked again. The approved sentence stays in every one. */
export const JESSICA_COST_VARIANTS: string[][] = [
  ["Same honest answer: it depends on the type of capital, and how much work we have to do.", "Which one are you looking at?"],
  ["It depends on the type of capital, and how much work we have to do. That's the real answer, not a dodge.", "Tell me the capital type and the team puts a number on it."],
];

/** Chips after the cost line, and what Jessica says to each pick before offering times. */
export const JESSICA_COST_CHOICES: Record<string, JessicaChoice> = {
  Equity: { lines: ["Got it, that helps."], bridge: "The fastest way to a real number is a quick call with the team." },
  Debt: { lines: ["Got it, that helps."], bridge: "The fastest way to a real number is a quick call with the team." },
  "An SPV for a deal": { lines: ["Good, SPVs are something we set up for specific deals."], bridge: "The fastest way to a real number is a quick call with the team." },
  "Not sure yet": { lines: ["No problem, that's exactly what the first call sorts out."], bridge: "The team gives you a real number once they hear the details." },
};

export interface JessicaChoice {
  lines: string[];
  /** Bridge into the time offer. The chat appends the real open days right after it. */
  bridge: string;
}

export interface JessicaObjection {
  id: string;
  match: RegExp;
  /** Said first. Ends with a question when `choices` is set. */
  lines: string[];
  /** Other ways to say `lines`, used when the same objection comes back. Never the same words twice. */
  variants?: string[][];
  /** Chips. The visitor's pick decides the follow up. */
  choices?: Record<string, JessicaChoice>;
  /** Bridge into the time offer when there are no chips. */
  bridge?: string;
}

/**
 * Replies to common objections, from the iCFO sales training (Question Close,
 * Backwards Close, Columbo Close, specific next meeting). Rules for every line:
 * short, no prices or discounts, no fee tied to raising capital, no promise of
 * funding, and Jessica never asks whether they want a call, only when.
 */
export const JESSICA_OBJECTIONS: JessicaObjection[] = [
  {
    id: "upfront-fee",
    match: /up ?front|pay (first|before)|don'?t want to pay|no fees? (up|before)/i,
    lines: [
      "That's fair, nobody wants to pay before they see the value.",
      "Help me understand what matters most to you here: is it the cost, or making sure you get in front of the right investors?",
    ],
    variants: [
      ["Fair enough. Let me ask it another way: is the worry the money itself, or whether it gets you the right investors?"],
      ["I hear you on that. Which matters more right now, cost or getting the right investors in the room?"],
    ],
    choices: {
      "The cost": {
        lines: ["Understood. The honest answer is that it depends on the type of capital, and how much work we have to do."],
        bridge: "The team can walk you through exactly what that looks like for your raise.",
      },
      "The investors": {
        lines: ["That's the right thing to focus on. We match you with investors whose mandate fits your company, then follow up with the ones who show interest."],
        bridge: "It's easier to show you than to explain.",
      },
      Both: {
        lines: ["Both make sense. The cost depends on the capital and the work involved, and the investor match is something we can show you live."],
        bridge: "Let's do that together.",
      },
    },
  },
  {
    id: "need-to-ask-team",
    match: /\b(board|my team|partners?|co-?founders?|think about it|talk (it )?over|discuss (it )?with)\b/i,
    lines: ["Of course, that's a decision worth making together. Can I ask, how long have you been raising?"],
    variants: [
      ["Makes sense, bring them in. One thing helps me help you: how long has the raise been going?"],
      ["Understood. Quick one so I can prep the team: how long have you been at this raise?"],
    ],
    choices: {
      "Under 3 months": {
        lines: ["That's a good moment to get clear answers early."],
        bridge: "A 30 minute call gives you something concrete to bring to your team.",
      },
      "3 to 6 months": {
        lines: ["That's a while to carry on your own."],
        bridge: "A 30 minute call gives you something concrete to bring to your team.",
      },
      "Over 6 months": {
        lines: ["That's a long time to carry on your own."],
        bridge: "A 30 minute call gives you something concrete to bring to your board.",
      },
    },
  },
  {
    id: "send-info",
    match: /send (me |us )?(some |more |your |the )?(info|information|details|deck|material)|email me|more info/i,
    lines: ["Happy to send it over. So I send the right thing, tell me, what's been the hardest part of raising so far?"],
    variants: [
      ["Will do. One question so it's useful, not generic: what's the hardest part of raising right now?"],
      ["Sure thing. Tell me what's been slowing the raise down and I'll send what fits."],
    ],
    choices: {
      "Reaching the right investors": {
        lines: ["Then you're in the right place. Finding investors that fit and following up with them is exactly what we do."],
        bridge: "I'll get the info to you, and honestly, 30 minutes with the team will tell you more than any PDF.",
      },
      "Getting ready for investors": {
        lines: ["That's where we start with everyone. We rate how ready you are and show you what to fix first."],
        bridge: "I'll get the info to you, and honestly, 30 minutes with the team will tell you more than any PDF.",
      },
      "Something else": {
        lines: ["Good to know. That's something the team can speak to directly."],
        bridge: "I'll get the info to you, and 30 minutes with the team will tell you more than any PDF.",
      },
    },
  },
  {
    id: "give-number",
    match: /give me a number|a number|ball ?park|exact(ly)? (price|cost|how much)|straight answer|just tell me/i,
    lines: ["I hear you. Any number I gave you now would be a guess, and you deserve a real one."],
    variants: [
      ["I'd be making it up, and you'd know. The real number comes from the team once they see the raise."],
      ["Straight answer: it's not a flat fee, it's sized to the capital and the work. The team sizes it on the call."],
    ],
    bridge: "Fifteen minutes with the team gets you exactly that.",
  },
  {
    id: "budget",
    match: /no budget|can'?t afford|too expensive|don'?t have (the )?(money|budget)|out of (my|our) budget/i,
    lines: [
      "Understood, budget matters.",
      "What we do depends on the type of capital and the work involved, so the starting point looks different for every company.",
    ],
    variants: [
      ["Got it. The scope moves with the capital and the work, so it's rarely one size."],
      ["Understood. That's exactly why we don't quote blind, the starting point depends on your raise."],
    ],
    bridge: "Let's find out what yours looks like.",
  },
  {
    id: "not-interested",
    match: /not interested|no thanks|not for (me|us)|i'?ll pass/i,
    lines: ["No problem at all. One thing before you go, though: we have investors who are already active in your space."],
    variants: [
      ["Understood. Before you go, one thing: the investors we work with are already active where you are."],
      ["No pressure. I'll just say the network has investors in your space right now, and that's rare to pass on."],
    ],
    bridge: "It's worth fifteen minutes to see who they are.",
  },
];

export const JESSICA_AI_LINES = [
  "Fair question. I'm an AI assistant for the iCFO team.",
  "A real person from the team takes the call though. Want me to set one up?",
];
