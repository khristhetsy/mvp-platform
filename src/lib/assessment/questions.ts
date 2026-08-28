// The 10-question public assessment. Each option carries points; the sum is
// normalized to a 0-100 lead_prescore (never named `crr` — this is the lead
// magnet, not the full Capital Readiness Rating, which is behind the paywall).
// Shared by the public UI and the server-side scorer so a client can't spoof it.

export type AssessmentOption = { id: string; label: string; points: number };
export type AssessmentQuestion = {
  id: string;
  prompt: string;
  /** Marks the question whose answer we also persist as a structured field. */
  field?: "stage" | "capital_structure";
  options: AssessmentOption[];
};

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    id: "stage",
    prompt: "What stage is the company?",
    field: "stage",
    options: [
      { id: "pre_seed", label: "Pre-seed / idea", points: 3 },
      { id: "seed", label: "Seed", points: 7 },
      { id: "series_a_plus", label: "Series A or later", points: 10 },
    ],
  },
  {
    id: "revenue",
    prompt: "Where is revenue today?",
    options: [
      { id: "none", label: "Pre-revenue", points: 3 },
      { id: "early", label: "Early revenue (under $100K ARR)", points: 6 },
      { id: "growing", label: "$100K – $1M ARR", points: 8 },
      { id: "scaling", label: "$1M+ ARR", points: 10 },
    ],
  },
  {
    id: "raise_target",
    prompt: "How much are you raising?",
    options: [
      { id: "undecided", label: "Still deciding", points: 3 },
      { id: "under_500k", label: "Under $500K", points: 6 },
      { id: "500k_2m", label: "$500K – $2M", points: 9 },
      { id: "2m_plus", label: "$2M+", points: 8 },
    ],
  },
  {
    id: "capital_structure",
    prompt: "How do you plan to raise?",
    field: "capital_structure",
    options: [
      { id: "not_sure", label: "Not sure yet", points: 4 },
      { id: "reg_d_506b", label: "Reg D 506(b)", points: 9 },
      { id: "reg_d_506c", label: "Reg D 506(c)", points: 9 },
      { id: "reg_cf", label: "Reg CF / crowdfunding", points: 7 },
      { id: "other", label: "Other", points: 6 },
    ],
  },
  {
    id: "deck",
    prompt: "Do you have a pitch deck?",
    options: [
      { id: "none", label: "Not yet", points: 3 },
      { id: "rough", label: "A rough draft", points: 6 },
      { id: "polished", label: "A polished, current deck", points: 10 },
    ],
  },
  {
    id: "financials",
    prompt: "How complete is your financial model?",
    options: [
      { id: "none", label: "Nothing formal yet", points: 3 },
      { id: "basic", label: "A basic spreadsheet", points: 6 },
      { id: "three_statement", label: "A full three-statement model", points: 10 },
    ],
  },
  {
    id: "cap_table",
    prompt: "How clean is your cap table?",
    options: [
      { id: "messy", label: "Unmodeled notes / SAFEs", points: 3 },
      { id: "tracked", label: "Tracked but not reviewed", points: 6 },
      { id: "clean", label: "Clean and current", points: 10 },
    ],
  },
  {
    id: "data_room",
    prompt: "Do you have a data room ready?",
    options: [
      { id: "none", label: "No", points: 4 },
      { id: "partial", label: "Some documents gathered", points: 7 },
      { id: "ready", label: "Organized and ready to share", points: 10 },
    ],
  },
  {
    id: "team",
    prompt: "How would you describe the team?",
    options: [
      { id: "solo", label: "Solo founder, early", points: 4 },
      { id: "small", label: "Small team, key roles filled", points: 7 },
      { id: "experienced", label: "Experienced team, prior exits", points: 10 },
    ],
  },
  {
    id: "prior_raise",
    prompt: "Have you raised outside capital before?",
    options: [
      { id: "never", label: "Never", points: 4 },
      { id: "friends_family", label: "Friends & family / angels", points: 7 },
      { id: "institutional", label: "Institutional round(s)", points: 10 },
    ],
  },
];

/** Maximum achievable raw points across all questions (best option each). */
export const ASSESSMENT_MAX_POINTS = ASSESSMENT_QUESTIONS.reduce(
  (sum, q) => sum + Math.max(...q.options.map((o) => o.points)),
  0,
);
