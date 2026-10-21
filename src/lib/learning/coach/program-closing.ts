import type {
  ProgramDefinition,
  ProgramModule,
} from "@/lib/learning/coach/program";
import { CLOSING_PLAYBOOK_SLUG } from "@/lib/learning/closing-playbook";

/**
 * The coached program for the Closing Playbook: twelve modules, one a week, then the Monday review.
 * Same loop as the outreach program. Worked cases are illustrative founders, never one on the platform.
 * Modules on offering type, term sheets, valuation and closings are educational only; decisions are the
 * founder's with their counsel, and iCapOS records pledges and indications of interest only.
 */

const CLOSING_MODULES: ProgramModule[] = [
  {
    lessonSlug: "deal-room",
    week: 1,
    shortTitle: "Deal room",
    minutes: 12,
    intro:
      "Week 1 of 12 is about having a place where a committed investor can run diligence. Recall starts in week 2.",
    readScreen: {
      path: "Stage 4 Closing › Stage guide",
      title: "Stage guide",
      href: "/founder/stages/closing",
    },
    readNote:
      "On the right is Deal Room. You have 18 documents uploaded and no room open yet.",
    case: {
      title: "Seed stage B2B SaaS, $1M Reg D 506(c)",
      setup:
        'Omar has 20 documents in his data room and a lead investor who said "send me what you have." He has no deal room open.',
      lines: [
        "He opens one deal room for that investor and loads the first set: deck, financial model, cap table, incorporation documents.",
        "He leaves out drafts and old versions. Twelve current documents beat twenty with four duplicates.",
        "He sets a daily check on questions in Tasks, because a room nobody watches is a room that goes quiet.",
      ],
      rule: "Open the room before you are asked, load the current set only, and check it daily.",
    },
    companyQuestion:
      "You have 18 documents and no deal room. Which set goes in first?",
    companyOptions: [
      {
        label: "The current deck, model, cap table and incorporation documents",
        reply:
          "That is the first request from almost every investor. Load those four, then add on request.",
      },
      {
        label: "All 18",
        reply:
          "Eighteen with duplicates and drafts costs the investor time and you credibility. Current versions only.",
      },
      {
        label: "Wait until an investor asks",
        reply:
          "The ask comes with a clock on it. A room that already exists answers in minutes, not days.",
      },
    ],
    companyFollowUp:
      "Which investor is the room for, and what is the one question they will ask first?",
    companyFollowUpReply:
      "Then that answer goes in the room before they open it. Deal Room is on the right.",
    doScreen: {
      path: "Stage 4 Closing › Deal Room",
      title: "Deal Room",
      href: "/founder/deal-room",
    },
    doMetric: "deal_rooms",
    doIntro:
      "Open your deal room on the right and load the first set. I count open rooms.",
    doTarget: 1,
    doVerb: "Open room",
    doDone: "Room open. Three questions, then your commitment.",
    recall: [],
    tests: [
      {
        prompt: "When do you open a deal room?",
        options: [
          "Before an investor asks",
          "After a term sheet",
          "Only for the lead investor",
        ],
        rightIndex: 0,
        why: "The ask comes with a clock. A room that exists already answers in minutes.",
      },
      {
        prompt: "What goes in first?",
        options: [
          "Current deck, model, cap table, incorporation documents",
          "Everything you have",
          "Only the deck",
        ],
        rightIndex: 0,
        why: "That is the first request from almost every investor; the rest goes in on request.",
      },
      {
        prompt: "How many deal rooms do you have open today?",
        options: ["0", "1", "18"],
        rightIndex: 0,
        why: "Eighteen is your document count. Rooms are what investors use.",
      },
    ],
    commitHint: "open a deal room and load the first four documents",
    commitDone:
      "Module 1 is done. Next week I open with whether the room exists and what is in it.",
    faq: [
      [
        "Why open a room before anyone asks?",
        "Because the ask comes with a clock. Your 18 documents are already uploaded; a room takes minutes to open and days to be asked for. Open it today and the first request is answered in minutes.",
      ],
      [
        "Which of my 18 documents go in?",
        "Current versions only: deck, financial model, cap table, incorporation documents. I count 18 uploaded; I cannot see which are duplicates, you can.",
      ],
      [
        "Can one room serve several investors?",
        "One room per committed investor. Each sees their own questions, and you see who is active.",
      ],
    ],
    stuckHelp:
      "Open Stage 4 Closing › Deal Room, press New room, pick the investor. Then add the four documents from your library; nothing needs re-uploading.",
  },
  {
    lessonSlug: "documents",
    week: 2,
    shortTitle: "Documents",
    minutes: 12,
    intro:
      "Week 2. Two questions on last week, then the commitment check, then the documents themselves.",
    readScreen: {
      path: "Stage 2 Preparation › Documents",
      title: "Documents",
      href: "/founder/documents",
    },
    readNote:
      "On the right is Documents. You have 18 uploaded; which are current versions is yours to say, I only see the count.",
    case: {
      title: "Seed stage healthtech, $1.5M",
      setup:
        'Priya has 24 documents. Her room has been open for a week and the investor has asked for "the latest model" twice.',
      lines: [
        "She finds three versions of the model and two of the cap table. The investor was opening the oldest each time.",
        "She keeps one of each, dated in the file name, and removes the rest. 24 becomes 14.",
        "The next request is a question about the model, not a request for a newer one. That is diligence working.",
      ],
      rule: "One current version of each document, dated in the name, and nothing else in the room.",
    },
    companyQuestion:
      "Of your 18 documents, how many are a current version of something an investor will read?",
    companyOptions: [
      {
        label: "About 12, the rest are drafts or older versions",
        reply:
          "Then 12 is the room and 6 are the clean up. Remove or archive the 6 before the first investor opens it.",
      },
      {
        label: "All 18 are current",
        reply:
          "Then you are ahead. Check the dates in the file names so the investor can see it too.",
      },
      {
        label: "I am not sure",
        reply:
          'Then this week\'s Do step is the sort. Open Documents and read the dates; it takes twenty minutes and saves two weeks of "which one is current" questions.',
      },
    ],
    companyFollowUp:
      "Which document is the one you would least want an investor to read first, and why?",
    companyFollowUpReply:
      "That is the one to fix or remove this week. Documents is on the right.",
    doScreen: {
      path: "Stage 2 Preparation › Documents",
      title: "Documents",
      href: "/founder/documents",
    },
    doMetric: "documents",
    doIntro:
      "Mark the current versions on the right and archive the rest. I count documents with a date in the name.",
    doTarget: 4,
    doVerb: "Mark current",
    doDone: "Current set marked. Three questions, then your commitment.",
    recall: [
      {
        prompt: "Recall 1 of 2. When do you open a deal room?",
        options: [
          "Before an investor asks",
          "After a term sheet",
          "Only for the lead",
        ],
        rightIndex: 0,
      },
      {
        prompt: "Recall 2 of 2. What goes into the room first?",
        options: [
          "Current deck, model, cap table, incorporation documents",
          "Everything",
          "Only the deck",
        ],
        rightIndex: 0,
      },
    ],
    tests: [
      {
        prompt: "How many versions of each document belong in the room?",
        options: [
          "One, the current one",
          "All of them, for history",
          "Two, current and previous",
        ],
        rightIndex: 0,
        why: "Every extra version is a question before it is a document.",
      },
      {
        prompt: "What tells an investor a document is current?",
        options: [
          "The date in the file name",
          "The upload order",
          "Nothing, they ask",
        ],
        rightIndex: 0,
        why: "A date in the name answers the question before it is asked.",
      },
      {
        prompt: "How many documents do you have uploaded today?",
        options: ["18", "12", "0"],
        rightIndex: 0,
        why: "Read from your company. Which are current is the Do step.",
      },
    ],
    commitHint: "sort the 18 documents to one current version each by Friday",
    commitDone:
      "Saved. Next week I open with your document count and the room.",
    faq: [
      [
        "How do I know which version is current?",
        "The date in the file name. If two files could both be current, the newer is, and the older leaves the room.",
      ],
      [
        "What if an investor wants an older version?",
        "Rare, and they will ask. A room with one version each answers 95 of 100 requests without a question.",
      ],
      [
        "Do I delete the old ones?",
        "Archive, not delete. iCapOS keeps them out of the room and in your library.",
      ],
    ],
    stuckHelp:
      "Open Documents, sort by name, and for each pair of versions keep the newer one. Add the date to the four core files. Twenty minutes.",
  },
  {
    lessonSlug: "diligence-answers",
    week: 3,
    shortTitle: "Answer in 24h",
    minutes: 12,
    intro: "Week 3. Two recall questions, then the commitment check.",
    readScreen: {
      path: "Stage 4 Closing › Deal Room",
      title: "Deal Room",
      href: "/founder/deal-room",
    },
    readNote:
      "On the right is your deal room question list. You have 0 questions waiting today.",
    case: {
      title: "Seed stage healthtech, $1.5M",
      setup:
        "Priya has two investors in her room. One asked four questions on Monday. She answered on Friday.",
      lines: [
        "By Friday the investor had moved to the next company on their list. The questions were easy; the delay was the signal.",
        "She sets a 24 hour rule and a 9am check in Tasks. Partial answers go out same day with a date for the rest.",
        "The second investor asked six questions over two weeks. Every one answered within a day. That one went to a second meeting.",
      ],
      rule: "Every question answered within 24 hours, partial answers with a date, checked every morning.",
    },
    companyQuestion:
      "A question arrives you cannot fully answer for three days. What goes out today?",
    companyOptions: [
      {
        label: "What I know now, plus the date for the rest",
        reply:
          "That is the 24 hour rule. The investor learns you are responsive and organised, which is what diligence is testing.",
      },
      {
        label: "Nothing until the full answer is ready",
        reply:
          "The common mistake. Three days of silence reads as either disorganised or not interested.",
      },
      {
        label: "A holding message with no date",
        reply:
          "Better than silence, but a date is what lets the investor plan. Add it.",
      },
    ],
    companyFollowUp: "What time each day will you check the room?",
    companyFollowUpReply:
      "Put it in Tasks now, before the first question arrives. Deal Room is on the right.",
    doScreen: {
      path: "Stage 4 Closing › Deal Room",
      title: "Deal Room",
      href: "/founder/deal-room",
    },
    doMetric: "room_check",
    doIntro:
      "Set the daily check in Tasks and answer any open question on the right. I count unanswered questions and your task.",
    doTarget: 1,
    doVerb: "Set check",
    doDone: "Daily check set. Three questions, then your commitment.",
    recall: [
      {
        prompt:
          "Recall 1 of 2. How many versions of each document belong in the room?",
        options: ["One, the current one", "All of them", "Two"],
        rightIndex: 0,
      },
      {
        prompt: "Recall 2 of 2. What tells an investor a document is current?",
        options: ["The date in the file name", "Upload order", "Nothing"],
        rightIndex: 0,
      },
    ],
    tests: [
      {
        prompt: "What is the response window for a diligence question?",
        options: ["24 hours", "One week", "When the answer is complete"],
        rightIndex: 0,
        why: "Speed is the signal diligence is reading.",
      },
      {
        prompt: "You cannot answer fully today. What do you send?",
        options: [
          "What you know, with a date for the rest",
          "Nothing yet",
          "A request for more time",
        ],
        rightIndex: 0,
        why: "A partial answer with a date keeps the investor moving.",
      },
      {
        prompt: "How many questions are waiting in your room today?",
        options: ["0", "4", "18"],
        rightIndex: 0,
        why: "None yet. The habit is set before the first one arrives.",
      },
    ],
    commitHint:
      "check the deal room every morning at 9 and answer within 24 hours",
    commitDone: "Saved. Next week I read your unanswered count and the task.",
    faq: [
      [
        "What if I do not know the answer?",
        'Send what you know today with a date for the rest. "I will have the churn breakdown by Thursday" is a 24 hour answer. Silence is not.',
      ],
      [
        "24 hours even on weekends?",
        "One business day. The 9am check in Tasks is what makes it happen without you thinking about it.",
      ],
      [
        "Does speed really matter that much?",
        "In diligence the investor is reading how you operate. Four questions answered on Friday that arrived on Monday is the signal, whatever the answers were.",
      ],
    ],
    stuckHelp:
      'Open Workspace › Tasks, add "Check deal room questions", due today 9am, repeat daily. Answering starts when a question exists.',
  },
  {
    lessonSlug: "offering-type",
    week: 4,
    shortTitle: "Offering type",
    minutes: 12,
    intro:
      "Week 4. Two recall questions first, then the commitment check. This module is educational only; the structure you choose is a decision for you and your counsel.",
    readScreen: {
      path: "Stage 4 Closing › Offering type",
      title: "Offering type",
      href: "/founder/offering-type",
    },
    readNote:
      "On the right is Offering type. Yours is set: Reg D 506(c), raising $1,000,000.",
    case: {
      title: "Pre-seed fintech, $600K",
      setup:
        'Marcus listed his company with no offering type set. Two investors asked "is this a SAFE or priced?" and he gave two different answers.',
      lines: [
        "He sits with counsel for one hour and settles the structure for this round.",
        "He sets and attests the offering type in iCapOS, so every surface investors see says the same thing.",
        "The next investor question is about terms, not about what the instrument is. That is the conversation he wanted.",
      ],
      rule: "Settle the structure with counsel once, attest it in iCapOS, and never give two answers.",
    },
    companyQuestion:
      "Your offering type is Reg D 506(c). An investor asks what that means for who can invest. In your words, what do you say?",
    companyOptions: [
      {
        label:
          "Accredited investors only, verified, and I can talk about the raise publicly",
        reply:
          "That is the shape of 506(c) in one sentence. Say it the same way every time, and point to counsel for anything beyond it.",
      },
      {
        label: "Anyone can invest",
        reply:
          "That is not 506(c). Giving the wrong answer here costs trust fast; check the stage guide and your counsel.",
      },
      {
        label: "I am not sure",
        reply:
          "Then this week's task is one hour with counsel so you can answer in one sentence. The structure is already set; you need the words.",
      },
    ],
    companyFollowUp:
      "What is the one question about your structure you cannot yet answer in one sentence?",
    companyFollowUpReply:
      "That is the question for counsel this week. Offering type is on the right.",
    doScreen: {
      path: "Stage 4 Closing › Offering type",
      title: "Offering type",
      href: "/founder/offering-type",
    },
    doMetric: "offering_attested",
    doIntro:
      "Confirm the attested offering type on the right matches what you tell investors. I check the attestation.",
    doTarget: 1,
    doVerb: "Confirm",
    doDone: "Offering type confirmed. Three questions, then your commitment.",
    recall: [
      {
        prompt:
          "Recall 1 of 2. What is the response window for a diligence question?",
        options: ["24 hours", "One week", "When complete"],
        rightIndex: 0,
      },
      {
        prompt: "Recall 2 of 2. You cannot answer fully today. What goes out?",
        options: [
          "What you know, with a date",
          "Nothing",
          "A request for time",
        ],
        rightIndex: 0,
      },
    ],
    tests: [
      {
        prompt: "Who settles the offering structure?",
        options: ["You and your counsel", "iCapOS", "The lead investor"],
        rightIndex: 0,
        why: "iCapOS records what you attest; it does not choose for you.",
      },
      {
        prompt: "Why attest the type in iCapOS?",
        options: [
          "So every surface investors see says the same thing",
          "It is required to log in",
          "It raises your rating",
        ],
        rightIndex: 0,
        why: "Deal room, listing and SPV flow all read it.",
      },
      {
        prompt: "What is your attested offering type?",
        options: ["Reg D 506(c)", "SAFE", "Reg CF"],
        rightIndex: 0,
        why: "Read from your company record.",
      },
    ],
    commitHint:
      "book one hour with counsel on the questions I cannot answer in one sentence",
    commitDone:
      "Saved. Next week I check the task, not the answers; those are between you and counsel.",
    faq: [
      [
        "What does Reg D 506(c) mean in one sentence?",
        "Accredited investors only, with verification, and you may talk about the raise publicly. Anything beyond that is a question for your counsel.",
      ],
      [
        "Can I change the offering type later?",
        "You can change what is attested; whether you should is a counsel question. Changing it mid conversation is the mistake this module is about.",
      ],
      [
        "Why does the coach not advise on structure?",
        "Because it is legal and securities territory. I explain what each type sets and where it is recorded; the choice is yours with counsel.",
      ],
    ],
    stuckHelp:
      "Open Stage 4 Closing › Offering type and read the attested type. If the one sentence does not come, that is the counsel hour, and it is this week's commitment.",
  },
  {
    lessonSlug: "term-sheet",
    week: 5,
    shortTitle: "Term sheet",
    minutes: 14,
    intro:
      "Week 5. Two recall questions, then the commitment check. Educational only; terms are negotiated with your counsel.",
    readScreen: {
      path: "Prep & practice › Term sheet explainer",
      title: "Term sheet explainer",
      href: "/founder/term-sheet",
    },
    readNote:
      "On the right is the Term sheet explainer, with a sample sheet to walk through.",
    case: {
      title: "Seed stage B2B SaaS, $1.2M",
      setup:
        "Tomás received his first term sheet on a Thursday with a reply expected Monday. He had never read one.",
      lines: [
        "He runs it through the Term sheet explainer line by line and writes down the three he does not understand.",
        "Friday is one hour with counsel on those three, not on all fourteen.",
        "Monday he replies with two asks and one acceptance. The investor says it was the cleanest first response she had seen that quarter.",
      ],
      rule: "Read a sample term sheet now, know the three lines you would push on, and spend counsel time only on those.",
    },
    companyQuestion:
      "Which three lines of a term sheet would you push back on, and which would you accept as standard?",
    companyOptions: [
      {
        label:
          "Valuation, pro rata and board seat; accept standard information rights",
        reply:
          "That is the usual shape at seed. Knowing which three is the whole preparation; counsel does the wording.",
      },
      {
        label: "I would push on everything",
        reply:
          "Pushing on fourteen lines reads as not knowing which matter. Pick three; the rest is where you show you are reasonable.",
      },
      {
        label: "I would accept it as sent",
        reply:
          "Some founders do, and regret the liquidation preference later. Read it once now, with no deadline, so you know your three.",
      },
    ],
    companyFollowUp: "Which one line do you least understand today?",
    companyFollowUpReply:
      "That is the first one to read in the explainer, on the right.",
    doScreen: {
      path: "Prep & practice › Term sheet explainer",
      title: "Term sheet explainer",
      href: "/founder/term-sheet",
    },
    doMetric: "self_report",
    doIntro:
      "Walk the sample term sheet in the explainer on the right and mark the three lines you would negotiate. I count lines marked.",
    doTarget: 3,
    doVerb: "Mark line",
    doDone: "Three lines marked. Three questions, then your commitment.",
    recall: [
      {
        prompt: "Recall 1 of 2. Who settles the offering structure?",
        options: ["You and your counsel", "iCapOS", "The lead investor"],
        rightIndex: 0,
      },
      {
        prompt: "Recall 2 of 2. Why attest the type in iCapOS?",
        options: [
          "So every investor surface matches",
          "To log in",
          "To raise the rating",
        ],
        rightIndex: 0,
      },
    ],
    tests: [
      {
        prompt: "When should you first read a term sheet?",
        options: ["Before you receive one", "When it arrives", "After signing"],
        rightIndex: 0,
        why: "A deadline is the wrong time to learn the vocabulary.",
      },
      {
        prompt: "How many lines should counsel time go to?",
        options: [
          "The three you would push on",
          "All of them",
          "None, accept as sent",
        ],
        rightIndex: 0,
        why: "Three focused asks read as prepared; fourteen read as unprepared.",
      },
      {
        prompt: "Which of these moves control rather than money?",
        options: ["Board seat", "Valuation", "Amount"],
        rightIndex: 0,
        why: "A board seat is a control term; valuation and amount are money terms.",
      },
    ],
    commitHint:
      "walk the sample term sheet and write my three lines before Friday",
    commitDone: "Saved. Next week I check the task; the three lines are yours.",
    faq: [
      [
        "Which three lines matter most at seed?",
        "Usually valuation, pro rata and board seat. Liquidation preference is the one founders regret not reading. The explainer walks all of them.",
      ],
      [
        "Should I negotiate at all on a first term sheet?",
        "Three focused asks read as prepared. Accepting as sent or pushing on fourteen lines both read as not knowing which matter.",
      ],
      [
        "Is the explainer legal advice?",
        "No. It is the vocabulary so your hour with counsel goes on the three lines that matter, not on what the words mean.",
      ],
    ],
    stuckHelp:
      "Open Term sheet explainer, read the sample top to bottom once, and mark the three you would push. Do not try to understand all fourteen today.",
  },
  {
    lessonSlug: "valuation",
    week: 6,
    shortTitle: "Valuation",
    minutes: 14,
    intro:
      "Week 6. Two recall questions, then the commitment check. Educational only; the number is yours and your counsel's.",
    readScreen: {
      path: "Stage 2 Preparation › Valuation Studio",
      title: "Valuation Studio",
      href: "/founder/valuation",
    },
    readNote:
      "On the right is Valuation Studio. Your raise is $1,000,000; your valuation and use of funds have not been read in this mockup.",
    case: {
      title: "Seed stage climate hardware, $2M",
      setup:
        'Lena\'s deck says $10M post. The investor asked "how did you get there?" and she said "it felt right for the stage."',
      lines: [
        "She opens Valuation Studio, picks the two methods that fit hardware at seed, and writes the two sentences: the method and the comparable set.",
        "She rewrites use of funds as three lines, each with a milestone and a date: pilot hardware by March, two hires by April, 18 months of runway.",
        "The next investor asked the same question. The answer took thirty seconds and the conversation moved to terms.",
      ],
      rule: "Two sentences for the number, three dated lines for the money.",
    },
    companyQuestion:
      "An investor asks how you got to your valuation. What is your two sentence answer today?",
    companyOptions: [
      {
        label: "A method and a comparable set, in two sentences",
        reply:
          "That is the answer. Write it down so it is the same for every investor.",
      },
      {
        label: "It is what the market will bear",
        reply:
          "That is a negotiating position, not an explanation. The investor asked for the method. Valuation Studio gives you one.",
      },
      {
        label: "I do not have one yet",
        reply:
          "Then this week's Do step is the two sentences. Thirty minutes in Valuation Studio, then write them.",
      },
    ],
    companyFollowUp:
      "What are the three things the $1,000,000 buys, each with a date?",
    companyFollowUpReply:
      "Those three lines are your use of funds. Valuation Studio is on the right.",
    doScreen: {
      path: "Stage 2 Preparation › Valuation Studio",
      title: "Valuation Studio",
      href: "/founder/valuation",
    },
    doMetric: "self_report",
    doIntro:
      "Write the two valuation sentences and the three dated use of funds lines on the right. I count lines written.",
    doTarget: 3,
    doVerb: "Write line",
    doDone:
      "Valuation explained, use of funds dated. Three questions, then your commitment.",
    recall: [
      {
        prompt: "Recall 1 of 2. When should you first read a term sheet?",
        options: ["Before you receive one", "When it arrives", "After signing"],
        rightIndex: 0,
      },
      {
        prompt: "Recall 2 of 2. Which term moves control rather than money?",
        options: ["Board seat", "Valuation", "Amount"],
        rightIndex: 0,
      },
    ],
    tests: [
      {
        prompt: "What does an investor want behind the valuation number?",
        options: [
          "A method and a comparable set",
          "Confidence",
          "A bigger number",
        ],
        rightIndex: 0,
        why: "The method is what they can check.",
      },
      {
        prompt: "What does use of funds tie the money to?",
        options: ["Milestones with dates", "Departments", "A pie chart"],
        rightIndex: 0,
        why: "Dates are what make it a plan rather than a split.",
      },
      {
        prompt: "How long should the valuation answer be?",
        options: ["Two sentences", "A slide", "As long as it takes"],
        rightIndex: 0,
        why: "Thirty seconds, same for every investor.",
      },
    ],
    commitHint:
      "write my two valuation sentences and three dated use of funds lines",
    commitDone: "Saved. Next week I check the task; the sentences are yours.",
    faq: [
      [
        "Which valuation method fits me?",
        "Valuation Studio shows the methods and which fit SaaS at seed. Pick the two you can explain; the explanation is what investors check.",
      ],
      [
        "What if my number is too high?",
        "Then the method will say so before an investor does. Better to find out in the studio than in the room.",
      ],
      [
        "How detailed should use of funds be?",
        "Three lines with a date each. A pie chart tells investors the split; dates tell them the plan.",
      ],
    ],
    stuckHelp:
      "Open Valuation Studio, pick two methods, write the two sentences. Then three use of funds lines, each with a month. Thirty minutes.",
  },
  {
    lessonSlug: "closing-checklist",
    week: 7,
    shortTitle: "Checklist",
    minutes: 14,
    intro: "Week 7. Two recall questions, then the commitment check.",
    readScreen: {
      path: "Stage 4 Closing › SPVs & closings",
      title: "SPVs & closings",
      href: "/founder/spvs",
    },
    readNote:
      "On the right is SPVs and closings. You have no SPV or closing started.",
    case: {
      title: "Seed stage climate hardware, $2M",
      setup:
        "Lena has three investors ready to commit $150K each and no vehicle. Each wants to invest on different paperwork.",
      lines: [
        "She opens the SPV checklist and sees eleven items. Four need counsel, two need her bank, five are hers.",
        "She does her five in a day and books counsel for the four. The bank items start the same week because they take the longest.",
        "Three weeks later the vehicle is open and all three sign the same documents. Without the checklist it was three separate closings.",
      ],
      rule: "Start the checklist before the first commitment, and begin with the items that take longest.",
    },
    companyQuestion:
      "You have 0 SPVs and a $1,000,000 raise. When does the checklist start?",
    companyOptions: [
      {
        label: "Now, before the first commitment",
        reply:
          "Right. Every item takes longer than it looks, and investors do not wait well.",
      },
      {
        label: "After the lead commits",
        reply:
          "That is the common mistake. The lead commits, then waits weeks while the vehicle is built, and interest cools.",
      },
      {
        label: "I may not need an SPV",
        reply:
          "Maybe not, but the closing checklist runs either way. Start it; the SPV question is one item on it.",
      },
    ],
    companyFollowUp:
      "Which checklist item needs someone other than you, and who?",
    companyFollowUpReply:
      "Start that one first. SPVs and closings is on the right.",
    doScreen: {
      path: "Stage 4 Closing › SPVs & closings",
      title: "SPVs & closings",
      href: "/founder/spvs",
    },
    doMetric: "checklist",
    doIntro:
      "Open the SPV or closing checklist on the right and tick the items that are yours. I count checklist items done.",
    doTarget: 3,
    doVerb: "Tick item",
    doDone: "Checklist started. Three questions, then your commitment.",
    recall: [
      {
        prompt:
          "Recall 1 of 2. What does an investor want behind the valuation number?",
        options: [
          "A method and a comparable set",
          "Confidence",
          "A bigger number",
        ],
        rightIndex: 0,
      },
      {
        prompt: "Recall 2 of 2. What does use of funds tie the money to?",
        options: ["Milestones with dates", "Departments", "A pie chart"],
        rightIndex: 0,
      },
    ],
    tests: [
      {
        prompt: "When does the closing checklist start?",
        options: [
          "Before the first commitment",
          "After the lead commits",
          "At the closing",
        ],
        rightIndex: 0,
        why: "Every item takes longer than it looks.",
      },
      {
        prompt: "What does iCapOS record for investors in a closing?",
        options: [
          "Pledges and indications of interest only",
          "Wire transfers",
          "Share certificates",
        ],
        rightIndex: 0,
        why: "No money moves on the platform.",
      },
      {
        prompt: "Which items start first?",
        options: [
          "The ones that take longest",
          "The easiest ones",
          "The ones investors ask about",
        ],
        rightIndex: 0,
        why: "Bank and counsel items set the critical path.",
      },
    ],
    commitHint:
      "start the closing checklist and book the counsel and bank items",
    commitDone: "Saved. Next week I read the checklist count.",
    faq: [
      [
        "Do I need an SPV for $1,000,000?",
        "Not necessarily. The closing checklist runs either way; the SPV is one item on it. Investor count and paperwork decide it.",
      ],
      [
        "What takes longest on the checklist?",
        "Counsel and bank items. Start them this week even if commitments are months away.",
      ],
      [
        "Does money move through iCapOS?",
        "No. iCapOS records pledges and indications only. The closing happens with your counsel and your bank.",
      ],
    ],
    stuckHelp:
      "Open SPVs & closings, start the checklist, tick what is yours today. Book the counsel and bank items; leave them open.",
  },
  {
    lessonSlug: "pledges",
    week: 8,
    shortTitle: "Pledges",
    minutes: 12,
    intro: "Week 8. Two recall questions, then the commitment check.",
    readScreen: {
      path: "Stage 4 Closing › Capital Raise",
      title: "Capital Raise",
      href: "/founder/capital-raise",
    },
    readNote:
      "On the right is Capital Raise. Your raise is $1,000,000; pledges have not been read in this mockup.",
    case: {
      title: "Seed stage edtech, $900K",
      setup:
        'David "had about $600K committed." When his counsel asked who and how much, he had names in his head and no numbers in writing.',
      lines: [
        'He asks each investor for a one line pledge: amount and timing. Three reply the same day; two go quiet. "About $600K" becomes $420K written.',
        "He records the five in Capital Raise and sees the real gap: $480K, not $300K.",
        "The next six weeks of outreach are sized to $480K, and the two quiet ones get a follow up with a date.",
      ],
      rule: "A pledge is a written amount and a date, recorded the day you get it; the gap is what the outreach is sized to.",
    },
    companyQuestion:
      "Which investors have told you an amount in writing, and how much do they add up to?",
    companyOptions: [
      {
        label: "None in writing yet",
        reply:
          "Then the number is zero and the gap is $1,000,000. That is not bad news, it is the starting line the outreach playbook is for.",
      },
      {
        label: "A few, verbally",
        reply:
          "Verbal is interest, not a pledge. Ask each for one line with an amount and a date; the ones who reply are your pipeline.",
      },
      {
        label: "Some in writing, recorded",
        reply:
          "Then record them in Capital Raise today so the gap is a number you and your coach both see.",
      },
    ],
    companyFollowUp:
      "Who is the one investor you will ask for a written amount this week?",
    companyFollowUpReply:
      "That ask is the commitment. Capital Raise is on the right.",
    doScreen: {
      path: "Stage 4 Closing › Capital Raise",
      title: "Capital Raise",
      href: "/founder/capital-raise",
    },
    doMetric: "pledges",
    doIntro:
      "Record every written pledge in Capital Raise on the right. I count pledges recorded.",
    doTarget: 1,
    doVerb: "Record pledge",
    doDone: "Pledges recorded. Three questions, then your commitment.",
    recall: [
      {
        prompt: "Recall 1 of 2. When does the closing checklist start?",
        options: [
          "Before the first commitment",
          "After the lead commits",
          "At the closing",
        ],
        rightIndex: 0,
      },
      {
        prompt: "Recall 2 of 2. What does iCapOS record in a closing?",
        options: ["Pledges and indications only", "Wires", "Certificates"],
        rightIndex: 0,
      },
    ],
    tests: [
      {
        prompt: "What makes interest a pledge?",
        options: [
          "A written amount and a date",
          "A good meeting",
          "A verbal yes",
        ],
        rightIndex: 0,
        why: "Written, with a number and a date, is the only kind you can close on.",
      },
      {
        prompt: "What is the outreach sized to?",
        options: [
          "The gap between pledges and the raise",
          "The whole raise",
          "The pledges so far",
        ],
        rightIndex: 0,
        why: "Pledges change the gap; the gap sizes the work.",
      },
      {
        prompt: "What is your raise target?",
        options: ["$1,000,000", "$600,000", "$2,000,000"],
        rightIndex: 0,
        why: "Read from your company record.",
      },
    ],
    commitHint:
      "ask two investors for a written amount and record them in Capital Raise",
    commitDone: "Saved. Next week I open with your pledged total and the gap.",
    faq: [
      [
        "How do I ask for a written pledge?",
        'One line: "Can you confirm the amount and rough timing in writing so I can plan the close?" The ones who reply are your pipeline.',
      ],
      [
        "Is a pledge binding?",
        "No. It is a written intention, and the honest scoreboard. Binding comes with the closing documents and counsel.",
      ],
      [
        "What if nobody has pledged?",
        "Then the gap is $1,000,000 and the outreach playbook is sized to it. Zero in writing is a starting line, not a verdict.",
      ],
    ],
    stuckHelp:
      "Email each investor who said a number: one line asking for the amount and timing in writing. Record the replies in Capital Raise.",
  },
  {
    lessonSlug: "investor-updates",
    week: 9,
    shortTitle: "Updates",
    minutes: 12,
    intro: "Week 9. Two recall questions, then the commitment check.",
    readScreen: {
      path: "Stage 4 Closing › Investor update builder",
      title: "Investor update builder",
      href: "/founder/investor-update",
    },
    readNote:
      "On the right is the Investor update builder. Your last update went out Aug 8, 73 days ago.",
    case: {
      title: "Seed stage edtech, $900K",
      setup:
        'David sent one update in August, then nothing. In October his lead asked "are you still raising?"',
      lines: [
        "He sets a monthly update, first Tuesday, three sections: numbers, what changed, what he needs.",
        "The October update goes to 14 investors: 9 prospective, 5 committed. Two prospective ones reply the same day.",
        "By the November update, one of those two has pledged. The update did what the pitch had not.",
      ],
      rule: "One update a month, same day, same three sections, to everyone in the raise.",
    },
    companyQuestion:
      "73 days since your last update. What goes in the next one?",
    companyOptions: [
      {
        label: "Numbers, what changed since August, and what I need",
        reply:
          "That is the update. Three sections, no hype, and the ask at the end.",
      },
      {
        label: "A fundraising announcement",
        reply:
          "Investors in the raise already know. Give them progress; the raise is the context, not the content.",
      },
      {
        label: "Wait until I have better news",
        reply:
          "The common mistake. Silence after a gap reads worse than a flat month reported on time.",
      },
    ],
    companyFollowUp: "Which day of the month is update day, from now on?",
    companyFollowUpReply:
      "Put it in Calendar as a repeating block. The builder is on the right.",
    doScreen: {
      path: "Stage 4 Closing › Investor update builder",
      title: "Investor update builder",
      href: "/founder/investor-update",
    },
    doMetric: "updates_30d",
    doIntro:
      "Draft and send this month's update from the builder on the right. I count updates sent in the last 30 days.",
    doTarget: 1,
    doVerb: "Send update",
    doDone: "Update sent. Three questions, then your commitment.",
    recall: [
      {
        prompt: "Recall 1 of 2. What makes interest a pledge?",
        options: [
          "A written amount and a date",
          "A good meeting",
          "A verbal yes",
        ],
        rightIndex: 0,
      },
      {
        prompt: "Recall 2 of 2. What is the outreach sized to?",
        options: ["The gap", "The whole raise", "The pledges"],
        rightIndex: 0,
      },
    ],
    tests: [
      {
        prompt: "How often does an investor update go out?",
        options: ["Monthly, same day", "When there is good news", "Quarterly"],
        rightIndex: 0,
        why: "The rhythm is the point.",
      },
      {
        prompt: "What are the three sections?",
        options: [
          "Numbers, what changed, what I need",
          "Vision, team, ask",
          "Press, hires, events",
        ],
        rightIndex: 0,
        why: "Same three every time, so investors can compare months.",
      },
      {
        prompt: "How many days since your last update?",
        options: ["73", "30", "7"],
        rightIndex: 0,
        why: "Aug 8 to Oct 20. That is the gap this module closes.",
      },
    ],
    commitHint:
      "send the October investor update and block the first Tuesday monthly",
    commitDone: "Saved. Next week I check whether the update went out.",
    faq: [
      [
        "Who gets the update?",
        "Everyone in the raise: committed and prospective. Prospective readers are the ones an update converts.",
      ],
      [
        "What if the numbers are flat?",
        "Report them flat, on time. A flat month on the first Tuesday reads better than a great month reported 73 days late.",
      ],
    ],
    stuckHelp:
      'Press "Draft my October update" below. The AI drafts the three sections from your numbers; you edit and send. Ten minutes.',
  },
  {
    lessonSlug: "milestones",
    week: 10,
    shortTitle: "Milestones",
    minutes: 12,
    intro: "Week 10. Two recall questions, then the commitment check.",
    readScreen: {
      path: "Stage 4 Closing › Milestones",
      title: "Milestones",
      href: "/founder/milestones",
    },
    readNote:
      "On the right is Milestones. Yours have not been read in this mockup.",
    case: {
      title: "Priya, week 10",
      setup:
        "Priya's deck lists six milestones for the next twelve months. None has a date.",
      lines: [
        "She picks three for the next 90 days: pilot live, first paid customer, key hire. Each gets a number and a date.",
        "Her monthly update reports the three, hit or missed, with one line each.",
        'An investor in diligence says the update is why she signed: "I watched her hit two of three on time."',
      ],
      rule: "Three milestones for 90 days, each with a number and a date, reported in every update.",
    },
    companyQuestion:
      "Which three milestones will you hit in the next 90 days, with a number and a date each?",
    companyOptions: [
      {
        label: "Three with a number and a date",
        reply:
          "That is the list. It goes into the next update as the first section.",
      },
      {
        label: "All six from the deck",
        reply:
          "Six with no dates is a wish list. Pick the three you will hit; the other three come later.",
      },
      {
        label: "I would rather not commit to dates",
        reply:
          "Closing investors are watching whether you execute. A date you hit is the strongest signal you have.",
      },
    ],
    companyFollowUp: "Which one is at risk, and what would make it happen?",
    companyFollowUpReply:
      "That is the one to report on first. Milestones is on the right.",
    doScreen: {
      path: "Workspace › Tasks",
      title: "Tasks",
      href: "/founder/tasks",
    },
    doMetric: "milestone_tasks",
    doIntro:
      "Set three milestones with a number and a date on the right. I count milestones with a date.",
    doTarget: 3,
    doVerb: "Add milestone",
    doDone: "Three milestones set. Three questions, then your commitment.",
    recall: [
      {
        prompt: "Recall 1 of 2. How often does an investor update go out?",
        options: ["Monthly, same day", "When there is good news", "Quarterly"],
        rightIndex: 0,
      },
      {
        prompt: "Recall 2 of 2. What are the three sections?",
        options: [
          "Numbers, what changed, what I need",
          "Vision, team, ask",
          "Press, hires, events",
        ],
        rightIndex: 0,
      },
    ],
    tests: [
      {
        prompt: "How many milestones for the next 90 days?",
        options: ["Three", "Six", "As many as the deck lists"],
        rightIndex: 0,
        why: "Three you will hit beat eight you might.",
      },
      {
        prompt: "What does each milestone need?",
        options: ["A number and a date", "A paragraph", "An owner"],
        rightIndex: 0,
        why: "So anyone can say whether it was hit.",
      },
      {
        prompt: "Where do milestones get reported?",
        options: [
          "In every investor update",
          "At the closing",
          "In the deck only",
        ],
        rightIndex: 0,
        why: "The update is where investors watch you execute.",
      },
    ],
    commitHint:
      "set three milestones with dates and put them in the next update",
    commitDone: "Saved. Next week I open with your milestone count.",
    faq: [
      [
        "How do I pick three out of six?",
        "The three you will hit in 90 days with a number you can measure. The other three go in the next 90.",
      ],
      [
        "What if I miss one?",
        "Report it missed, with one line on why and the new date. Investors are watching whether you say so.",
      ],
      [
        "Where do milestones show up?",
        "In every investor update as the first section, and on your Milestones page. Same list in both.",
      ],
    ],
    stuckHelp:
      "Open Milestones. Three, each a number and a date. If you cannot put a number on it, it is not a milestone yet.",
  },
  {
    lessonSlug: "closing-week",
    week: 11,
    shortTitle: "Closing",
    minutes: 14,
    intro:
      "Week 11. Two recall questions, then the commitment check. This is the week the checklist becomes a close.",
    readScreen: {
      path: "Stage 4 Closing › SPVs & closings",
      title: "Closing review",
      href: "/founder/spvs",
    },
    readNote:
      "On the right is SPVs and closings, at the closing review step. You have no closing in progress.",
    case: {
      title: "Lena, closing week",
      setup:
        'Lena\'s vehicle has been open for five weeks. Three investors are in, two documents are still "with counsel," and one investor has gone quiet.',
      lines: [
        "She opens the closing review and lists the open items: two documents, one signature, one bank confirmation. Each gets a name and a date, today.",
        "She calls the quiet investor rather than emailing. He had a question about pro rata he had not asked; answered in ten minutes.",
        "Signatures by Thursday, bank confirmation Friday. The close took five weeks and one hard week; the hard week was this one.",
      ],
      rule: "In closing week every open item has a person and a date, and quiet investors get a call, not an email.",
    },
    companyQuestion:
      "A committed investor goes quiet in closing week. What do you do first?",
    companyOptions: [
      {
        label: "Call them today and ask what is open",
        reply:
          "That is the move. In the worked case it was an unasked question, answered in ten minutes.",
      },
      {
        label: "Send one more email",
        reply:
          "Email is what they went quiet on. A call finds the real reason; an email finds nothing.",
      },
      {
        label: "Give them a week",
        reply: "A week in closing week is a month in the close. Call today.",
      },
    ],
    companyFollowUp:
      "Which open item is the one most likely to slip, and who owns it?",
    companyFollowUpReply:
      "That one gets a date today and a chase on Wednesday. The closing review is on the right.",
    doScreen: {
      path: "Stage 4 Closing › SPVs & closings",
      title: "Closing review",
      href: "/founder/spvs",
    },
    doMetric: "self_report",
    doIntro:
      "In the closing review on the right, give every open item a person and a date. I count items with both.",
    doTarget: 3,
    doVerb: "Assign",
    doDone:
      "Every open item owned and dated. Three questions, then your commitment.",
    recall: [
      {
        prompt: "Recall 1 of 2. How many milestones for 90 days?",
        options: ["Three", "Six", "All of them"],
        rightIndex: 0,
      },
      {
        prompt: "Recall 2 of 2. What does each milestone need?",
        options: ["A number and a date", "A paragraph", "An owner"],
        rightIndex: 0,
      },
    ],
    tests: [
      {
        prompt: "What does every open item need in closing week?",
        options: ["A person and a date", "A reminder email", "Patience"],
        rightIndex: 0,
        why: "Ownership and a date are what make an item move.",
      },
      {
        prompt: "A committed investor goes quiet. First move?",
        options: ["Call them today", "Email again", "Wait a week"],
        rightIndex: 0,
        why: "A call finds the real reason in minutes.",
      },
      {
        prompt: "Where do signing and money happen?",
        options: [
          "With your counsel and your bank",
          "In iCapOS",
          "In the deal room",
        ],
        rightIndex: 0,
        why: "iCapOS tracks the checklist and participations; it never moves money.",
      },
    ],
    commitHint:
      "chase every open closing item on Wednesday and call anyone who is quiet",
    commitDone: "Saved. Next week I open with the closing review count.",
    faq: [
      [
        "What if counsel is the slow one?",
        "Counsel gets a date too, and a call on Wednesday. Closing week is the one week you chase everyone, counsel included.",
      ],
      [
        "Can I close in two stages?",
        "Often, yes, with counsel. A first close on the committed money keeps momentum; the rest join a second close. Ask counsel this week.",
      ],
      [
        "What does iCapOS do on closing day?",
        "Tracks the checklist and the participations. Signing and money are with your counsel and your bank.",
      ],
    ],
    stuckHelp:
      "Open the closing review, list every open item, put a name and a date on each. Then call, do not email, anyone quiet.",
  },
  {
    lessonSlug: "after-close",
    week: 12,
    shortTitle: "After close",
    minutes: 12,
    intro:
      "Week 12. Two recall questions, then the commitment check. After this week, the Monday review runs every week.",
    readScreen: {
      path: "Prep & practice › Board meeting prep",
      title: "Board meeting prep",
      href: "/founder/board-prep",
    },
    readNote:
      "On the right is Board meeting prep. You have no closed round yet, so this module reads as the plan.",
    case: {
      title: "Priya, after the close",
      setup:
        "Priya closed $1.5M on a Friday and spent the next month building. Her investors heard nothing for six weeks.",
      lines: [
        "She sends the close update the following Monday: amount, who is in, what the money does, the three milestones.",
        "She sets the cadence: monthly update first Tuesday, quarterly board meeting with the prep kit two weeks before.",
        "In Analytics she reads which outreach produced the cheques. Next round starts with those channels, nine months out.",
      ],
      rule: "Close update within a week, monthly update and quarterly board meeting from then on, next round planned from this one's data.",
    },
    companyQuestion: "When your round closes, what goes out in the first week?",
    companyOptions: [
      {
        label:
          "The close update: amount, who is in, what it buys, the three milestones",
        reply: "That is the update, and it is the first one in the cadence.",
      },
      {
        label: "A press release",
        reply:
          "Investors first, press second. The investors who wired are the ones who need the thank you and the plan.",
      },
      {
        label: "Nothing, I will be building",
        reply:
          "That is the common mistake. Six weeks of silence after a close is where next round cheques are lost.",
      },
    ],
    companyFollowUp:
      "Which quarter will your first board meeting be, and what is the one decision it needs to make?",
    companyFollowUpReply:
      "Put the prep kit two weeks before it on Calendar. Board meeting prep is on the right.",
    doScreen: {
      path: "Prep & practice › Board meeting prep",
      title: "Board meeting prep",
      href: "/founder/board-prep",
    },
    doMetric: "self_report",
    doIntro:
      "Set the reporting cadence on the right: monthly update day and the first board meeting date. I count cadence items set.",
    doTarget: 2,
    doVerb: "Set",
    doDone: "Cadence set. Three questions, then your commitment.",
    recall: [
      {
        prompt: "Recall 1 of 2. What does every open closing item need?",
        options: ["A person and a date", "A reminder", "Patience"],
        rightIndex: 0,
      },
      {
        prompt:
          "Recall 2 of 2. A committed investor goes quiet in closing week. First move?",
        options: ["Call them today", "Email again", "Wait a week"],
        rightIndex: 0,
      },
    ],
    tests: [
      {
        prompt: "When does the close update go out?",
        options: [
          "Within a week of the close",
          "At the next board meeting",
          "When the next raise starts",
        ],
        rightIndex: 0,
        why: "The investors who wired need the thank you and the plan first.",
      },
      {
        prompt: "What is the reporting cadence after a close?",
        options: [
          "Monthly update, quarterly board meeting",
          "Annual report",
          "As needed",
        ],
        rightIndex: 0,
        why: "A rhythm investors can predict is what keeps them warm for the next round.",
      },
      {
        prompt: "Where do you plan the next round from?",
        options: [
          "This round's outreach data in Analytics",
          "A fresh list",
          "The same deck",
        ],
        rightIndex: 0,
        why: "What produced cheques this time is where the next round starts.",
      },
    ],
    commitHint:
      "set the monthly update day and the first board meeting on Calendar",
    commitDone:
      "Saved. From here the Monday review opens each week with your closing numbers.",
    faq: [
      [
        "What goes in the close update?",
        "Amount, who is in, what the money buys, the three milestones. One page, within a week of the close.",
      ],
      [
        "How often is the board meeting?",
        "Quarterly, with the prep kit two weeks before. Monthly updates in between.",
      ],
      [
        "When does the next round start?",
        "Nine months before you need it, from the channels Analytics shows produced cheques this time.",
      ],
    ],
    stuckHelp:
      "Open Calendar: monthly update first Tuesday, board meeting next quarter with the prep kit two weeks before. Two blocks.",
  },
];

export const CLOSING_PROGRAM: ProgramDefinition = {
  courseSlug: CLOSING_PLAYBOOK_SLUG,
  title: "Closing Playbook",
  modules: CLOSING_MODULES,
  review: {
    lessonSlug: "monday-review",
    shortTitle: "Monday review",
    minutes: 5,
    intro:
      "Monday review, five minutes. Two recall questions, then your closing numbers against last week, then one commitment.",
    recall: [
      {
        prompt: "Recall 1 of 2. When does the close update go out?",
        options: [
          "Within a week of the close",
          "At the board meeting",
          "Next raise",
        ],
        rightIndex: 0,
      },
      {
        prompt: "Recall 2 of 2. What is the diligence response window?",
        options: ["24 hours", "One week", "When complete"],
        rightIndex: 0,
      },
    ],
    companyQuestion:
      "What got in the way last week? One sentence, the honest one.",
    companyOptions: [
      {
        label: "No time blocked for it",
        reply:
          "That is the most common one, and it has the simplest fix: a block on Calendar.",
      },
      {
        label: "Waiting on counsel or the bank",
        reply:
          "Then the commitment is the chase, with a date. Waiting is a decision too.",
      },
      {
        label: "No investor is in the room yet",
        reply:
          "Then this week is Stage 3 work: the outreach playbook feeds this one. Send the update anyway; prospective investors read it.",
      },
    ],
    companyFollowUp:
      "And what is the one thing that would have made it happen?",
    companyFollowUpReply: "Good. That goes in the commitment.",
    commitHint:
      "send the update Tuesday and chase counsel on the checklist Wednesday",
    commitDone: "Next Monday I open with whether this one was met.",
    faq: [
      [
        "Why review on Monday?",
        "Because the week is still ahead. A review on Friday reports; a review on Monday changes what happens.",
      ],
      [
        "What if nothing changed this week?",
        "Then the review takes two minutes and the commitment is the thing that would make next week different.",
      ],
      [
        "Can I skip a review?",
        "You can. I open the next one with the gap. The streak counts weeks where every resolved commitment was kept.",
      ],
    ],
  },
  benchmarks: [
    {
      key: "lessons",
      label: "Closing modules completed",
      lessonTarget: "One module a week",
      stage: "No published benchmark",
      industry: "No published benchmark",
    },
    {
      key: "deal_rooms",
      label: "Deal rooms open",
      lessonTarget: "1 before the first investor asks",
      stage: "No published benchmark",
      industry: "No published benchmark",
    },
    {
      key: "questions",
      label: "Diligence questions waiting",
      lessonTarget:
        "0; every one answered within 24 hours (the stage guide's own rule)",
      stage: "No published benchmark",
      industry: "No published figure",
    },
    {
      key: "updates",
      label: "Investor updates, last 30 days",
      lessonTarget: "1 a month",
      stage: "No published benchmark with a stated sample",
      industry: "No published figure",
    },
    {
      key: "checklist",
      label: "Closing checklist readiness",
      lessonTarget: "Started before the first commitment",
      stage: "No published benchmark",
      industry: "No published benchmark",
    },
    {
      key: "pledged",
      label: "Pledged against the raise",
      lessonTarget: "Tracked, not graded",
      stage: "No published benchmark for pledges",
      industry: "No published figure",
    },
    {
      key: "weeks",
      label: "Weeks raising",
      lessonTarget: "Tracked, not graded; the program is 12 weeks",
      stage:
        "50% of successful seed raises took 13 to 24 weeks in 2023; 46% took 1 to 12 weeks in 2022 (DocSend, n=170)",
      industry:
        "SaaS founders: 47% spend 4 to 6 months raising, 31% 1 to 3 months (High Alpha 2026, n not stated). Estimate: 4 to 6 months for SaaS at seed.",
    },
    {
      key: "meetings_ts",
      label: "Meetings before a term sheet",
      lessonTarget: "Tracked, not graded",
      stage:
        "5 to 8 in 2026 (Qubit Capital, secondhand via a 2026 roundup; treat as indicative)",
      industry: "No sector figure. Estimate: same as all sectors.",
    },
  ],
  sources: [
    "DocSend 2023 seed report, 170 seed stage decks, H2 2022 to H1 2023.",
    "High Alpha, SaaS fundraising in 2026, early stage B2B SaaS founders, respondent count not stated.",
    "Qubit Capital figure on meetings per term sheet, secondhand via a 2026 roundup, not verified against the original.",
  ],
};
