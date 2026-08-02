/**
 * Events page static copy — ported VERBATIM from icapos-site-mock.html (spec §6,
 * §13). The schedule itself is DB-backed (marketing_events, §6); this holds the
 * surrounding sections. Event compliance note is load-bearing.
 */
export const events = {
  hero: {
    eyebrow: "iCFO events",
    title: "Companies present to investors, every month.",
    sub: "iCFO runs a recurring investment conference and an in-person expo series where rated companies present to investors from the iCFO network. Attendance is free. Stage time comes with a founder plan.",
    primaryCta: { label: "Register for the next event", href: "/start" },
    secondaryCta: { label: "Get a presentation slot", href: "/pricing" },
    compliance: "iCFO events are informational. Presentations are made by the companies themselves and are not offers to sell securities.",
    nextBanner: { title: "iCFO PE Expo — Newport Beach", detail: "August 25, 2026 · 12:00–4:00 PM PDT" },
  },
  series: {
    title: "The event series",
    tag: "Nationwide",
    items: [
      { code: "CONF", h: "iCFO Investment Conference", p: "Monthly · Founder presentations to the network" },
      { code: "EXPO", h: "iCFO PE Expo", p: "In-person, rotating cities · Half-day format" },
      { code: "REEL", h: "Founder Spotlight", p: "60-second pitches, broadcast to the network" },
    ],
    note: "Free to attend, both sides. No fee to present.",
  },
  schedule: {
    eyebrow: "Upcoming",
    title: "Current schedule.",
    sub: "Dates and presenting companies are confirmed ahead of each event. Anything below without a confirmed date isn't open for registration yet.",
    filters: ["All events", "PE Expo", "Investment Conference"],
    note: "Entries without a confirmed date are placeholders for the recurring schedule and are not yet open for registration.",
  },
  watch: {
    eyebrow: "Watch a past event",
    title: "See the format before you commit to it.",
    p: "Recordings from previous iCFO conferences and expos are on our channel — full presentations, investor Q&A, and the panel sessions. It's the fastest way to judge whether the room is worth your afternoon.",
    points: [
      "Full-length founder presentations from past sessions",
      "Investor Q&A, unedited",
      "Talk show episodes with founders and investors",
    ],
    cta: { label: "Open the iCFO channel", href: "https://www.youtube.com/@icfocapital" },
  },
  format: {
    eyebrow: "The format",
    title: "What an iCFO event actually looks like.",
    p: "Events follow the same shape, whether it's the monthly conference or an in-person expo: a short market briefing, founder presentations, the Spotlight reel, then open floor. No panels, no keynotes, no sponsor parade.",
    points: [
      "Half a day, start to finish — usually four hours",
      "Presenting companies arrive with a readiness rating attached",
      "Free for investors and founders to attend",
      "Presenting companies are listed in the event booklet",
    ],
    runTitle: "Typical run of show",
    runTag: "Half day",
    run: [
      { t: "12:00", h: "Doors and networking", p: "Registration, floor open" },
      { t: "12:30", h: "Market open", p: "iCFO capital markets briefing" },
      { t: "1:00", h: "Founder presentations", p: "Professional-plan companies, live" },
      { t: "2:30", h: "Founder Spotlight reel", p: "60-second pitches, Basic-plan companies" },
      { t: "3:00", h: "Investor floor", p: "Open conversations until close" },
    ],
  },
  twoWays: {
    title: "Two ways to be seen",
    sub: "Stage time, or the reel.",
    pro: {
      tag: "PROFESSIONAL",
      h: "Live presentation slot",
      p: "A presentation to the room, with your deck on screen and questions from investors in attendance. Slots are allocated monthly to Professional-plan founders.",
      points: ["Time on stage with your deck and live Q&A", "Your slot confirmed with you ahead of the event", "Your profile in the event booklet"],
    },
    basic: {
      tag: "BASIC",
      h: "Founder Spotlight",
      p: "Submit a 60-second video pitch. Approved pitches are cut into a single reel shown at the event and shared with the network afterward — a shorter format, same room.",
      points: ["Submit from your dashboard, reviewed before inclusion", "Reel shared with the network after the event", "Your profile in the event booklet"],
    },
  },
  forInvestors: {
    eyebrow: "For investors",
    title: "Come for the four hours. Nothing follows unless you want it to.",
    p: "Attendance is free and carries no obligation. Nothing at an iCFO event is an offer to sell securities, and any interest you express is a non-binding indication only.",
    points: [
      "Every presenting company arrives with a readiness rating",
      "Attending doesn't change your monthly volume cap",
      "Follow-ups run through your account, at your pace",
    ],
    compliance: "Event compliance. iCFO events are informational. Presentations are made by the companies themselves. iCFO Capital Global, Inc. does not endorse, recommend, or verify any presenting company, and receives no compensation contingent on any investment.",
  },
  nextUp: {
    title: "Next up: August 25, Newport Beach.",
    sub: "Free to attend. Presentation slots come with the Professional plan.",
    primaryCta: { label: "Register free", href: "/start" },
    secondaryCta: { label: "See plans", href: "/pricing" },
  },
} as const;
