import type { HowToGuideData } from "@/lib/founder/how-to-types";

/**
 * The "how to use" guides for the founder pages, one per page or page group.
 * Every tap label is the real text on the page (checked against the page code).
 * Manual outreach and Investor directory keep their own guides and are not here.
 * A guide with no routes is mounted by its page (see HowToByKey).
 */
export const HOW_TO_GUIDES: HowToGuideData[] = [
  {
    "key": "company-profile",
    "routes": [
      "/founder/settings"
    ],
    "title": "How your company profile works",
    "steps": [
      {
        "title": "Click a field to edit",
        "desc": "Each row on the Profile tab turns into an input when you click it.",
        "tap": {
          "kind": "field",
          "label": "Company name"
        },
        "then": "Field opens for editing"
      },
      {
        "title": "Save the field",
        "desc": "Press the check button next to the field to save that one change.",
        "tap": {
          "kind": "button",
          "label": "Save"
        },
        "then": "Row shows new value"
      },
      {
        "title": "Undo a change",
        "desc": "Use the undo arrow if you want the old value back before saving.",
        "tap": {
          "kind": "button",
          "label": "Undo"
        },
        "then": "Old value returns"
      },
      {
        "title": "Open the One pager tab",
        "desc": "This tab shows the page investors see and a link switch for sharing it.",
        "tap": {
          "kind": "button",
          "label": "One pager"
        },
        "then": "One pager preview"
      },
      {
        "title": "Preview as investor",
        "desc": "Open the full investor view of your profile to check how it reads.",
        "tap": {
          "kind": "link",
          "label": "Preview as investor"
        },
        "then": "Full preview page"
      }
    ]
  },
  {
    "key": "my-progress",
    "routes": [
      "/founder/journey"
    ],
    "title": "How your progress page works",
    "steps": [
      {
        "title": "Find your current stage",
        "desc": "The stage marked Current shows where you are in the journey.",
        "tap": {
          "kind": "watch",
          "label": "Current"
        },
        "then": "Stage highlighted"
      },
      {
        "title": "Check the Qualify requirements",
        "desc": "Each requirement shows whether it is met, so you can see what is left.",
        "tap": {
          "kind": "check",
          "label": "Onboarding complete"
        },
        "then": "Met or not met"
      },
      {
        "title": "Open your workspace",
        "desc": "Use the button on your current stage to go and do the work.",
        "tap": {
          "kind": "link",
          "label": "Open Qualify workspace →"
        },
        "then": "Qualify workspace"
      },
      {
        "title": "Jump to a quick link",
        "desc": "The links at the bottom take you straight to your documents and more.",
        "tap": {
          "kind": "link",
          "label": "Documents"
        },
        "then": "Documents page"
      }
    ]
  },
  {
    "key": "action-center",
    "routes": [
      "/founder/actions"
    ],
    "title": "How your action center works",
    "steps": [
      {
        "title": "Read the summary cards",
        "desc": "The cards count your active, overdue, escalated and recently completed actions.",
        "tap": {
          "kind": "watch",
          "label": "Active"
        },
        "then": "Cards show counts"
      },
      {
        "title": "Search your actions",
        "desc": "Type a word to narrow the list to the actions you want.",
        "tap": {
          "kind": "field",
          "label": "Search actions…"
        },
        "then": "List narrows"
      },
      {
        "title": "Open an action",
        "desc": "Press the button on a row to see its details.",
        "tap": {
          "kind": "button",
          "label": "Open →"
        },
        "then": "Detail drawer opens"
      },
      {
        "title": "Complete or snooze it",
        "desc": "Inside the details, pick what should happen to that action.",
        "tap": {
          "kind": "button",
          "label": "Complete"
        },
        "then": "List refreshes"
      }
    ]
  },
  {
    "key": "one-pager",
    "routes": [
      "/founder/preview"
    ],
    "title": "How your one-pager preview works",
    "steps": [
      {
        "title": "Read it as an investor",
        "desc": "This page mirrors what investors see on your one-pager.",
        "tap": {
          "kind": "watch",
          "label": "Preview"
        },
        "then": "Investor view"
      },
      {
        "title": "Check the published notice",
        "desc": "If you see the not published notice, investors cannot open it yet.",
        "tap": {
          "kind": "watch",
          "label": "Your profile is not published"
        },
        "then": "Publish status"
      },
      {
        "title": "Edit your profile",
        "desc": "Use this button to go change the details you see here.",
        "tap": {
          "kind": "link",
          "label": "Edit profile"
        },
        "then": "Company profile page"
      },
      {
        "title": "Open the live link",
        "desc": "When your page is live, this opens the public version in a new tab.",
        "tap": {
          "kind": "link",
          "label": "Open live link ↗"
        },
        "then": "Public page opens"
      }
    ]
  },
  {
    "key": "crr",
    "routes": [
      "/founder/readiness/wizard"
    ],
    "title": "How the score wizard works",
    "steps": [
      {
        "title": "Read your rating",
        "desc": "The top card shows your Capital Readiness Rating and how far the outreach gate is.",
        "tap": {
          "kind": "watch",
          "label": "Capital Readiness Rating"
        },
        "then": "Score and gate"
      },
      {
        "title": "See where points are",
        "desc": "The bars show how much each area adds to your rating.",
        "tap": {
          "kind": "watch",
          "label": "Where your points are, at your stage"
        },
        "then": "Points per area"
      },
      {
        "title": "Follow the ranked steps",
        "desc": "Work through the listed steps in order, starting at the top.",
        "tap": {
          "kind": "watch",
          "label": "Do these, in this order"
        },
        "then": "Ranked step list"
      },
      {
        "title": "Open a missing item",
        "desc": "Expand a checklist step to see what is missing and where to fix it.",
        "tap": {
          "kind": "button",
          "label": "Still missing"
        },
        "then": "Step details open"
      },
      {
        "title": "Mark a step as done",
        "desc": "This marks the step done on this page only. The rating changes when it is re-run.",
        "tap": {
          "kind": "button",
          "label": "Mark as done →"
        },
        "then": "Next step opens"
      }
    ]
  },
  {
    "key": "readiness-checklist",
    "routes": [
      "/founder/readiness"
    ],
    "title": "How the readiness checklist works",
    "steps": [
      {
        "title": "Check your rating",
        "desc": "The top card shows your Capital Readiness Rating and what it still needs.",
        "tap": {
          "kind": "watch",
          "label": "Capital Readiness Rating"
        },
        "then": "Score and gate"
      },
      {
        "title": "Review the gap list",
        "desc": "Each gap shows the points it could add and a way to fix it.",
        "tap": {
          "kind": "link",
          "label": "Fix with your documents"
        },
        "then": "Documents page"
      },
      {
        "title": "Open a progress card",
        "desc": "Tap a card to see its detail in a drawer.",
        "tap": {
          "kind": "button",
          "label": "Profile completion"
        },
        "then": "Detail drawer opens"
      },
      {
        "title": "Read the next actions",
        "desc": "This list names the most useful steps to take next.",
        "tap": {
          "kind": "watch",
          "label": "Recommended next actions"
        },
        "then": "Prioritized steps"
      }
    ]
  },
  {
    "key": "data-room",
    "routes": [
      "/founder/readiness/data-room"
    ],
    "title": "How your data room works",
    "steps": [
      {
        "title": "See what to add next",
        "desc": "The top card tracks your documents and points to the next item.",
        "tap": {
          "kind": "watch",
          "label": "Get investor-ready"
        },
        "then": "Progress and next item"
      },
      {
        "title": "Grant an investor access",
        "desc": "Enter an investor email and choose how long access lasts.",
        "tap": {
          "kind": "field",
          "label": "investor@email.com"
        },
        "then": "Email entered"
      },
      {
        "title": "Confirm the access",
        "desc": "Press the button to give that investor access to your data room.",
        "tap": {
          "kind": "button",
          "label": "Grant access"
        },
        "then": "Investor listed"
      },
      {
        "title": "Take access back",
        "desc": "Revoke any investor whose access should end.",
        "tap": {
          "kind": "button",
          "label": "Revoke"
        },
        "then": "Access removed"
      },
      {
        "title": "Answer investor questions",
        "desc": "Write a reply under a question and post it.",
        "tap": {
          "kind": "button",
          "label": "Post answer"
        },
        "then": "Answer shown"
      }
    ]
  },
  {
    "key": "documents",
    "routes": [
      "/founder/documents"
    ],
    "title": "How documents work",
    "steps": [
      {
        "title": "Choose your PDFs",
        "desc": "Pick one or several PDF files. Other file types are not accepted.",
        "tap": {
          "kind": "button",
          "label": "Choose files"
        },
        "then": "Category window opens"
      },
      {
        "title": "Pick a category",
        "desc": "Say what kind of document it is, and add a label if you like.",
        "tap": {
          "kind": "field",
          "label": "Category"
        },
        "then": "Category chosen"
      },
      {
        "title": "Upload the files",
        "desc": "Confirm to add the files to that category.",
        "tap": {
          "kind": "button",
          "label": "Upload as"
        },
        "then": "Files appear listed"
      },
      {
        "title": "Mark a category as N/A",
        "desc": "If a document type does not apply to you, mark it so.",
        "tap": {
          "kind": "button",
          "label": "Mark N/A"
        },
        "then": "Category marked N/A"
      },
      {
        "title": "Check uploaded files",
        "desc": "The list shows every file you added and its status.",
        "tap": {
          "kind": "watch",
          "label": "Uploaded files"
        },
        "then": "Files and statuses"
      }
    ]
  },
  {
    "key": "business-plan",
    "routes": [
      "/founder/business-plan"
    ],
    "title": "How the business plan works",
    "steps": [
      {
        "title": "Pick a section",
        "desc": "Choose any section from the list on the left to work on it.",
        "tap": {
          "kind": "button",
          "label": "Section list on the left"
        },
        "then": "Section editor opens"
      },
      {
        "title": "Draft with AI",
        "desc": "Let AI write a first version, then edit it so it sounds like you.",
        "tap": {
          "kind": "button",
          "label": "Draft with AI"
        },
        "then": "Draft appears in box"
      },
      {
        "title": "Mark N/A if needed",
        "desc": "If a section does not apply, say so and add an optional note.",
        "tap": {
          "kind": "button",
          "label": "Doesn't apply to us? Mark N/A"
        },
        "then": "Note box opens"
      },
      {
        "title": "Save your work",
        "desc": "Save your edits so they are kept on your plan.",
        "tap": {
          "kind": "button",
          "label": "Save"
        },
        "then": "Saved time shows"
      },
      {
        "title": "Finalize the plan",
        "desc": "When every section is done, finalize to save the PDF to Documents.",
        "tap": {
          "kind": "button",
          "label": "Finalize"
        },
        "then": "Plan finalized message"
      }
    ]
  },
  {
    "key": "pitch-deck",
    "routes": [
      "/founder/pitch-deck"
    ],
    "title": "How the pitch deck works",
    "steps": [
      {
        "title": "Pick a slide",
        "desc": "Choose a slide from the list to see its headline and bullets.",
        "tap": {
          "kind": "button",
          "label": "Slide list on the left"
        },
        "then": "Slide editor opens"
      },
      {
        "title": "Write from your plan",
        "desc": "Fill the slide from your business plan, then tweak the words.",
        "tap": {
          "kind": "button",
          "label": "Write from my plan"
        },
        "then": "Draft fills headline and body"
      },
      {
        "title": "Choose a theme",
        "desc": "Pick a look for your deck. It applies to preview, PDF and PPTX.",
        "tap": {
          "kind": "button",
          "label": "Theme"
        },
        "then": "Preview changes style"
      },
      {
        "title": "Save your edits",
        "desc": "Save so your slide changes are kept.",
        "tap": {
          "kind": "button",
          "label": "Save"
        },
        "then": "Saved message appears"
      },
      {
        "title": "Finalize and share",
        "desc": "Finalize to lock the deck, then download it or copy a read-only link.",
        "tap": {
          "kind": "button",
          "label": "Finalize"
        },
        "then": "Deck locked, downloads show"
      }
    ]
  },
  {
    "key": "cap-table",
    "routes": [
      "/founder/cap-table"
    ],
    "title": "How the cap table works",
    "steps": [
      {
        "title": "Add your holders",
        "desc": "Add each founder, pool or investor, with their share class and shares.",
        "tap": {
          "kind": "button",
          "label": "+ Add holder"
        },
        "then": "New row appears"
      },
      {
        "title": "Check ownership",
        "desc": "Look at the fully diluted percentages and the founder ownership figure.",
        "tap": {
          "kind": "watch",
          "label": "Founder ownership"
        },
        "then": "Percentages update live"
      },
      {
        "title": "Model a round",
        "desc": "Tick the box, then enter new investment and pre-money valuation.",
        "tap": {
          "kind": "check",
          "label": "Include a round"
        },
        "then": "Dilution figures appear"
      },
      {
        "title": "Save your changes",
        "desc": "Save your holders and any modeled round.",
        "tap": {
          "kind": "button",
          "label": "Save"
        },
        "then": "Saved time shows"
      },
      {
        "title": "Export a copy",
        "desc": "Export to Excel or PDF and the file is saved to your Documents.",
        "tap": {
          "kind": "button",
          "label": "Export PDF"
        },
        "then": "File saved message"
      }
    ]
  },
  {
    "key": "valuation",
    "routes": [
      "/founder/valuation"
    ],
    "title": "How Valuation Studio works",
    "steps": [
      {
        "title": "Choose your data source",
        "desc": "Start from your company profile, or enter everything by hand.",
        "tap": {
          "kind": "button",
          "label": "Pull from my company profile"
        },
        "then": "Stage screen opens"
      },
      {
        "title": "Pick your stage",
        "desc": "Choose the stage that fits your company so the right methods run.",
        "tap": {
          "kind": "button",
          "label": "Pre-seed"
        },
        "then": "Inputs for that stage"
      },
      {
        "title": "Enter the round",
        "desc": "Fill in what you are raising and the other inputs shown.",
        "tap": {
          "kind": "field",
          "label": "Amount you are raising"
        },
        "then": "Range updates live"
      },
      {
        "title": "Read the range",
        "desc": "See where the methods land and carry the range, not one number.",
        "tap": {
          "kind": "watch",
          "label": "Where the methods land"
        },
        "then": "Range and method bars"
      },
      {
        "title": "Save or get a plan",
        "desc": "Save your valuation, or ask the advisor how to move the number.",
        "tap": {
          "kind": "button",
          "label": "Get improvement plan"
        },
        "then": "Improvement levers appear"
      }
    ]
  },
  {
    "key": "financial-model",
    "routes": [
      "/founder/financial-model"
    ],
    "title": "How the financial model works",
    "steps": [
      {
        "title": "Check your drivers",
        "desc": "Review the drivers, which carry over from your business plan if set.",
        "tap": {
          "kind": "field",
          "label": "Your drivers"
        },
        "then": "Projection updates live"
      },
      {
        "title": "Reset if needed",
        "desc": "Reset puts the drivers back to their starting values.",
        "tap": {
          "kind": "button",
          "label": "Reset"
        },
        "then": "Drivers return to defaults"
      },
      {
        "title": "Read the projection",
        "desc": "Scan revenue, gross profit and year-end cash across the three years.",
        "tap": {
          "kind": "watch",
          "label": "3-year projection"
        },
        "then": "Table shows each year"
      },
      {
        "title": "Preview the model",
        "desc": "Open a read-only look at your results and drivers.",
        "tap": {
          "kind": "button",
          "label": "Preview"
        },
        "then": "Read-only preview opens"
      },
      {
        "title": "Generate the Excel file",
        "desc": "Create the Excel model, which is saved to your Documents.",
        "tap": {
          "kind": "button",
          "label": "Generate Excel model"
        },
        "then": "Saved file message"
      }
    ]
  },
  {
    "key": "pitch-deck-analyzer",
    "routes": [
      "/founder/pitch-deck-analyzer"
    ],
    "title": "How the pitch deck analyzer works",
    "steps": [
      {
        "title": "Upload your deck",
        "desc": "If no deck is on file yet, add one on the Documents page.",
        "tap": {
          "kind": "link",
          "label": "Upload pitch deck →"
        },
        "then": "Documents page opens"
      },
      {
        "title": "Run the analysis",
        "desc": "Start the AI review of your latest uploaded pitch deck.",
        "tap": {
          "kind": "button",
          "label": "Analyze with AI"
        },
        "then": "Scored results appear"
      },
      {
        "title": "Read your score",
        "desc": "See the overall score and the simulated investor first impression.",
        "tap": {
          "kind": "watch",
          "label": "Overall score"
        },
        "then": "Strengths and gaps listed"
      },
      {
        "title": "Open each section",
        "desc": "Expand a section in the breakdown to see feedback and its quick fix.",
        "tap": {
          "kind": "watch",
          "label": "Section-by-section breakdown"
        },
        "then": "Feedback and tip show"
      },
      {
        "title": "Save your results",
        "desc": "Save the analysis so you can come back to it.",
        "tap": {
          "kind": "button",
          "label": "Save"
        },
        "then": "Saved time shows"
      }
    ]
  },
  {
    "key": "round-structure",
    "routes": [
      "/founder/round-structure"
    ],
    "title": "How the round structure calculator works",
    "steps": [
      {
        "title": "Pick your round type",
        "desc": "Choose SAFE, convertible note or priced round. The fields below change with your choice.",
        "tap": {
          "kind": "button",
          "label": "Convertible note"
        },
        "then": "Note terms appear"
      },
      {
        "title": "Enter your terms",
        "desc": "Set the cap, raise amount and option pool. A SAFE adds a discount switch. A note adds interest, maturity, discount and warrants.",
        "tap": {
          "kind": "field",
          "label": "Raise amount"
        },
        "then": "Ownership split updates"
      },
      {
        "title": "Read your ownership",
        "desc": "See what investors, the option pool and existing holders each own after the round.",
        "tap": {
          "kind": "watch",
          "label": "Post-round ownership"
        },
        "then": "Stacked ownership bar"
      },
      {
        "title": "Run the AI analysis",
        "desc": "Compare your terms with published data from Carta, PitchBook NVCA, Cooley and CRV. Every figure comes from a sourced library.",
        "tap": {
          "kind": "button",
          "label": "Run AI analysis"
        },
        "then": "Report appears below"
      },
      {
        "title": "Check the sources",
        "desc": "Tap a reference number to see where a figure came from, or print the report to share with an advisor.",
        "tap": {
          "kind": "button",
          "label": "Print or save as PDF"
        },
        "then": "Print dialog opens"
      }
    ]
  },
  {
    "key": "market-claim",
    "routes": [
      "/founder/market-claim"
    ],
    "title": "How the market claim grader works",
    "steps": [
      {
        "title": "Choose a source",
        "desc": "Use your data room pitch deck, or upload a different PDF.",
        "tap": {
          "kind": "button",
          "label": "Use your pitch deck from the data room"
        },
        "then": "Source selected"
      },
      {
        "title": "Grade your claim",
        "desc": "Run the grader on the file you chose.",
        "tap": {
          "kind": "button",
          "label": "Grade my market claim"
        },
        "then": "Report appears"
      },
      {
        "title": "Read the objections",
        "desc": "See what investors may push back on and the fix for each.",
        "tap": {
          "kind": "watch",
          "label": "What investors will push back on"
        },
        "then": "Ranked objections list"
      },
      {
        "title": "Try the what-if",
        "desc": "Select the fixes you plan to make to see a projected grade.",
        "tap": {
          "kind": "button",
          "label": "What-if"
        },
        "then": "Fix checklist opens"
      },
      {
        "title": "Check the sources",
        "desc": "See where each graded value came from, or print the report.",
        "tap": {
          "kind": "button",
          "label": "Sources"
        },
        "then": "Source table opens"
      }
    ]
  },
  {
    "key": "ai-diligence-report",
    "routes": [
      "/founder/report"
    ],
    "title": "How the diligence report works",
    "steps": [
      {
        "title": "Generate your report",
        "desc": "Create a diligence report from the documents you have uploaded.",
        "tap": {
          "kind": "button",
          "label": "Generate my report"
        },
        "then": "Report appears"
      },
      {
        "title": "Read the findings",
        "desc": "Review the summary, risk flags, missing documents and recommendations.",
        "tap": {
          "kind": "watch",
          "label": "Investor readiness score"
        },
        "then": "Report sections below"
      },
      {
        "title": "Download or print",
        "desc": "Get a PDF copy of the report.",
        "tap": {
          "kind": "button",
          "label": "Download PDF"
        },
        "then": "PDF file opens"
      },
      {
        "title": "Create an investor link",
        "desc": "Optionally name who it is for, then make a link they can open.",
        "tap": {
          "kind": "field",
          "label": "Who is it for? (optional)"
        },
        "then": "Name typed in"
      },
      {
        "title": "Share the link",
        "desc": "Create the link, then copy it. You can turn it off anytime.",
        "tap": {
          "kind": "button",
          "label": "Create link"
        },
        "then": "New link listed"
      }
    ]
  },
  {
    "key": "diligence-review",
    "routes": [
      "/founder/readiness/diligence"
    ],
    "title": "How diligence and review works",
    "steps": [
      {
        "title": "Check your profile checklist",
        "desc": "Each core company field shows Complete or Incomplete so you can spot gaps.",
        "tap": {
          "kind": "watch",
          "label": "Company profile checklist"
        },
        "then": "See what's missing"
      },
      {
        "title": "Fix gaps in settings",
        "desc": "Open company settings to fill in anything marked Incomplete.",
        "tap": {
          "kind": "link",
          "label": "Update company settings"
        },
        "then": "Company settings opens"
      },
      {
        "title": "Read your review status",
        "desc": "See where the admin review stands, plus any notes left for you.",
        "tap": {
          "kind": "watch",
          "label": "Review status"
        },
        "then": "Status and notes"
      },
      {
        "title": "Open your diligence report",
        "desc": "Once an AI diligence report exists, you can open the full version.",
        "tap": {
          "kind": "link",
          "label": "Open full report"
        },
        "then": "Full report opens"
      }
    ]
  },
  {
    "key": "prep-practice",
    "routes": [
      "/founder/pitch-practice"
    ],
    "title": "How pitch practice works",
    "steps": [
      {
        "title": "Narrow the questions",
        "desc": "Tap a category or difficulty chip to show only those investor questions.",
        "tap": {
          "kind": "button",
          "label": "Traction"
        },
        "then": "List filters down"
      },
      {
        "title": "Read the answer framework",
        "desc": "Each question has tabs with a framework, a strong example, and things to avoid.",
        "tap": {
          "kind": "button",
          "label": "Answer framework"
        },
        "then": "Framework steps show"
      },
      {
        "title": "Write your own answer",
        "desc": "Type your answer in the box and watch the length bar fill.",
        "tap": {
          "kind": "field",
          "label": "Your answer"
        },
        "then": "Word count updates"
      },
      {
        "title": "Check your answer",
        "desc": "After ten words, you get a short length-based note to compare with the example.",
        "tap": {
          "kind": "button",
          "label": "Check my answer"
        },
        "then": "Feedback appears below"
      }
    ]
  },
  {
    "key": "learning",
    "routes": [
      "/founder/learning"
    ],
    "title": "How learning works",
    "steps": [
      {
        "title": "Pick up where you left off",
        "desc": "The Continue learning cards link to your next lesson or playbook module.",
        "tap": {
          "kind": "watch",
          "label": "Continue learning"
        },
        "then": "Next lesson cards"
      },
      {
        "title": "Open Capital readiness",
        "desc": "This tab lists your stages, which stay locked until the earlier one is done.",
        "tap": {
          "kind": "button",
          "label": "Capital readiness"
        },
        "then": "Stage ladder shows"
      },
      {
        "title": "Get your AI plan",
        "desc": "Open your learning plan to see what to learn next.",
        "tap": {
          "kind": "link",
          "label": "My AI learning plan"
        },
        "then": "Plan page opens"
      },
      {
        "title": "Review your progress",
        "desc": "Check your progress and badges after finishing lessons.",
        "tap": {
          "kind": "link",
          "label": "Progress & badges"
        },
        "then": "Progress page opens"
      }
    ]
  },
  {
    "key": "investor-matches",
    "routes": [
      "/founder/matches"
    ],
    "title": "How investor matches work",
    "steps": [
      {
        "title": "Search your matches",
        "desc": "Type a type, sector, or reason to narrow the ranked investor list.",
        "tap": {
          "kind": "field",
          "label": "Search matches"
        },
        "then": "List narrows"
      },
      {
        "title": "Open an investor",
        "desc": "Click a row to see the fit breakdown and what the investor looks for.",
        "tap": {
          "kind": "watch",
          "label": "Investor row"
        },
        "then": "Detail panel opens"
      },
      {
        "title": "Ask for an introduction",
        "desc": "Request an introduction once your rating clears the gate shown on the page.",
        "tap": {
          "kind": "button",
          "label": "Request introduction"
        },
        "then": "Shows iCFO reviewing"
      },
      {
        "title": "Answer interested investors",
        "desc": "Under Interested investors, approve or decline an introduction request.",
        "tap": {
          "kind": "button",
          "label": "Approve introduction"
        },
        "then": "Status updates"
      }
    ]
  },
  {
    "key": "matching-center",
    "routes": [
      "/founder/matching"
    ],
    "title": "How the matching center works",
    "steps": [
      {
        "title": "Read the match counts",
        "desc": "Two tiles show your matched contacts and how many are strong fits.",
        "tap": {
          "kind": "watch",
          "label": "matched contacts"
        },
        "then": "Counts at the top"
      },
      {
        "title": "Filter the ranked list",
        "desc": "Search by type, sector, or reason to find the investors you want.",
        "tap": {
          "kind": "field",
          "label": "Search matches"
        },
        "then": "List narrows"
      },
      {
        "title": "Switch the view",
        "desc": "Flip between a compact list and larger cards.",
        "tap": {
          "kind": "button",
          "label": "cards"
        },
        "then": "Cards layout shows"
      },
      {
        "title": "Ask for an introduction",
        "desc": "Identities stay private until iCapOS makes an introduction.",
        "tap": {
          "kind": "button",
          "label": "Request introduction"
        },
        "then": "Shows iCFO reviewing"
      }
    ]
  },
  {
    "key": "my-contacts",
    "routes": [
      "/founder/contacts"
    ],
    "title": "How my contacts works",
    "steps": [
      {
        "title": "Start a new contact",
        "desc": "Open the add panel to enter an investor you already know.",
        "tap": {
          "kind": "button",
          "label": "+ New"
        },
        "then": "Add form opens"
      },
      {
        "title": "Fill in the details",
        "desc": "Name is required. Firm, email, and investor type are optional extras.",
        "tap": {
          "kind": "field",
          "label": "Name"
        },
        "then": "Form fills in"
      },
      {
        "title": "Add the contact",
        "desc": "Submit the form to add the investor to your list.",
        "tap": {
          "kind": "button",
          "label": "Add contact"
        },
        "then": "Contact joins the list"
      },
      {
        "title": "Find contacts fast",
        "desc": "Use the search box or the source filters to narrow the list.",
        "tap": {
          "kind": "field",
          "label": "Search name, firm, email, sector…"
        },
        "then": "List narrows"
      },
      {
        "title": "Send picks to outreach",
        "desc": "Tick contacts, then jump to the outreach page.",
        "tap": {
          "kind": "link",
          "label": "Add to outreach"
        },
        "then": "Outreach page opens"
      }
    ]
  },
  {
    "key": "outreach-automated",
    "routes": [],
    "title": "How automated outreach works",
    "steps": [
      {
        "title": "Read the outreach banner",
        "desc": "It says whether automated outreach is on or paused for your rating.",
        "tap": {
          "kind": "watch",
          "label": "Automated outreach"
        },
        "then": "On or paused"
      },
      {
        "title": "Watch the live strip",
        "desc": "A scrolling strip lists your ranked investors with their match scores.",
        "tap": {
          "kind": "watch",
          "label": "Live"
        },
        "then": "Names scroll by"
      },
      {
        "title": "Open a summary card",
        "desc": "Tap a card to see what the number means for you.",
        "tap": {
          "kind": "button",
          "label": "Total investor contacts"
        },
        "then": "Explainer pops up"
      },
      {
        "title": "Filter the investor board",
        "desc": "Switch between all matches, not contacted, and in outreach.",
        "tap": {
          "kind": "button",
          "label": "In outreach"
        },
        "then": "Board filters"
      },
      {
        "title": "Open an investor profile",
        "desc": "Click a row to see the fit breakdown and positioning tips.",
        "tap": {
          "kind": "watch",
          "label": "Investor row"
        },
        "then": "Profile panel opens"
      }
    ]
  },
  {
    "key": "social-media",
    "routes": [
      "/founder/deploy/social"
    ],
    "title": "How social media works",
    "steps": [
      {
        "title": "Connect your accounts",
        "desc": "Open Settings and connect the social accounts you want to post from.",
        "tap": {
          "kind": "button",
          "label": "Settings"
        },
        "then": "Connected accounts list"
      },
      {
        "title": "Write your post",
        "desc": "Type your post, or jot notes and use the AI agent helpers.",
        "tap": {
          "kind": "button",
          "label": "Compose"
        },
        "then": "Post editor opens"
      },
      {
        "title": "Choose how to publish",
        "desc": "Save a draft, post now, or schedule it for later.",
        "tap": {
          "kind": "button",
          "label": "Save draft"
        },
        "then": "Post joins your Library"
      },
      {
        "title": "Track what worked",
        "desc": "Check Attribution to see which campaigns led to clicks and meetings.",
        "tap": {
          "kind": "button",
          "label": "Attribution"
        },
        "then": "Campaign results table"
      }
    ]
  },
  {
    "key": "ai-agent",
    "routes": [
      "/founder/ir-agent"
    ],
    "title": "How your IR agent works",
    "steps": [
      {
        "title": "Set up your agent",
        "desc": "Choose your address ending, name and welcome lines, then describe your company.",
        "tap": {
          "kind": "button",
          "label": "Build"
        },
        "then": "Agent settings form"
      },
      {
        "title": "Teach it answers",
        "desc": "Add questions investors ask with your own short answers, or upload a PDF.",
        "tap": {
          "kind": "button",
          "label": "Teach"
        },
        "then": "Answer joins your list"
      },
      {
        "title": "Confirm and go live",
        "desc": "Save your changes, tick the compliance notice, then go live.",
        "tap": {
          "kind": "button",
          "label": "Go live"
        },
        "then": "Status shows Live"
      },
      {
        "title": "Share your link",
        "desc": "Copy your agent link or a tracked link for each channel.",
        "tap": {
          "kind": "button",
          "label": "Share"
        },
        "then": "Links and QR code"
      },
      {
        "title": "Review conversations",
        "desc": "See who talked to your agent, who left details and who booked.",
        "tap": {
          "kind": "button",
          "label": "Conversations"
        },
        "then": "Investor conversation list"
      }
    ]
  },
  {
    "key": "investor-crm",
    "routes": [
      "/founder/investor-pipeline"
    ],
    "title": "How your investor pipeline works",
    "steps": [
      {
        "title": "Add an investor",
        "desc": "Enter the investor's name and details, then add them to your pipeline.",
        "tap": {
          "kind": "button",
          "label": "+ Add Investor"
        },
        "then": "Add Investor form"
      },
      {
        "title": "Import platform matches",
        "desc": "Pull in investors that iCapOS matched to you, then pick the ones you want.",
        "tap": {
          "kind": "button",
          "label": "Import from Matches"
        },
        "then": "Matches list opens"
      },
      {
        "title": "Find investors fast",
        "desc": "Search by investor, firm or sector to narrow the list.",
        "tap": {
          "kind": "field",
          "label": "Search investor, firm, sector…"
        },
        "then": "List filters instantly"
      },
      {
        "title": "Open an investor card",
        "desc": "Click an investor's name to see their profile and notes.",
        "tap": {
          "kind": "watch",
          "label": "Investor name"
        },
        "then": "Investor card panel"
      },
      {
        "title": "Export your list",
        "desc": "Download your pipeline as a CSV file whenever you need it.",
        "tap": {
          "kind": "button",
          "label": "Export CSV"
        },
        "then": "CSV file downloads"
      }
    ]
  },
  {
    "key": "present-at-event",
    "routes": [
      "/founder/events/present"
    ],
    "title": "How presenting at an event works",
    "steps": [
      {
        "title": "Pick your format",
        "desc": "Choose a Spotlight video or a full presentation, if your plan offers both.",
        "tap": {
          "kind": "button",
          "label": "Full presentation"
        },
        "then": "Form fields update"
      },
      {
        "title": "Choose an event",
        "desc": "Select one of the events that are open for applications.",
        "tap": {
          "kind": "watch",
          "label": "Choose an event"
        },
        "then": "Event is highlighted"
      },
      {
        "title": "Add your talk details",
        "desc": "Give your talk a title and fill in the details the form asks for.",
        "tap": {
          "kind": "field",
          "label": "Talk title"
        },
        "then": "Form fills in"
      },
      {
        "title": "Submit your application",
        "desc": "Confirm the disclaimer where shown, then send your application to the events team.",
        "tap": {
          "kind": "button",
          "label": "Submit application"
        },
        "then": "Application submitted notice"
      }
    ]
  },
  {
    "key": "marketplace",
    "routes": [
      "/founder/private-market"
    ],
    "title": "How the private market works",
    "steps": [
      {
        "title": "Check the summary cards",
        "desc": "Read the cards for network size, outreach so far and your average match score.",
        "tap": {
          "kind": "watch",
          "label": "Avg match score"
        },
        "then": "Card details open"
      },
      {
        "title": "Browse all matches",
        "desc": "See approved investors ranked by how well they fit your company profile.",
        "tap": {
          "kind": "button",
          "label": "All matches"
        },
        "then": "Ranked investor list"
      },
      {
        "title": "Filter by outreach",
        "desc": "Switch to investors not yet contacted, or those already in outreach.",
        "tap": {
          "kind": "button",
          "label": "Not contacted"
        },
        "then": "List narrows down"
      },
      {
        "title": "Open an investor",
        "desc": "Click a row to see the fit breakdown and criteria for that investor.",
        "tap": {
          "kind": "watch",
          "label": "Investor row"
        },
        "then": "Fit breakdown panel"
      }
    ]
  },
  {
    "key": "deal-room",
    "routes": [
      "/founder/deal-room"
    ],
    "title": "How deal rooms work",
    "steps": [
      {
        "title": "Get your profile ready",
        "desc": "Rooms open when an investor shows interest, so publish your company profile first.",
        "tap": {
          "kind": "link",
          "label": "Publish your profile"
        },
        "then": "Settings page opens"
      },
      {
        "title": "Add your documents",
        "desc": "Upload the PDF documents investors may ask to see.",
        "tap": {
          "kind": "link",
          "label": "Upload documents"
        },
        "then": "Documents page opens"
      },
      {
        "title": "Open a room",
        "desc": "Once a room exists, open it to answer questions and fulfil document requests.",
        "tap": {
          "kind": "link",
          "label": "Open →"
        },
        "then": "Deal room opens"
      },
      {
        "title": "Follow the progress",
        "desc": "Watch each room's milestone track and the activity feed below it.",
        "tap": {
          "kind": "watch",
          "label": "Activity feed"
        },
        "then": "Recent investor activity"
      }
    ]
  },
  {
    "key": "offering-type",
    "routes": [
      "/founder/offering-type"
    ],
    "title": "How choosing your capital structure works",
    "steps": [
      {
        "title": "Pick your structure",
        "desc": "Select the option that describes how you are raising, or not raising yet.",
        "tap": {
          "kind": "watch",
          "label": "Capital structure options"
        },
        "then": "Explanation appears below"
      },
      {
        "title": "Read the explanation",
        "desc": "Open the help section if you are unsure which option applies.",
        "tap": {
          "kind": "button",
          "label": "Not sure which applies to you?"
        },
        "then": "Plain definitions open"
      },
      {
        "title": "Confirm your choice",
        "desc": "Tick the box to confirm your choice describes your offering.",
        "tap": {
          "kind": "check",
          "label": "I confirm this accurately describes my offering exemption."
        },
        "then": "Continue becomes available"
      },
      {
        "title": "Continue onward",
        "desc": "Move on to the next onboarding step.",
        "tap": {
          "kind": "button",
          "label": "Continue"
        },
        "then": "Next step loads"
      }
    ]
  },
  {
    "key": "spvs",
    "routes": [
      "/founder/spvs"
    ],
    "title": "How SPVs and closings work",
    "steps": [
      {
        "title": "Learn what an SPV is",
        "desc": "Read the explainer, or open the learning page for more.",
        "tap": {
          "kind": "link",
          "label": "→ Learn about SPVs"
        },
        "then": "Learning page opens"
      },
      {
        "title": "Scan your summary boxes",
        "desc": "Check the boxes for active SPVs, total target and investors.",
        "tap": {
          "kind": "watch",
          "label": "Active SPVs"
        },
        "then": "Summary counts"
      },
      {
        "title": "Review each SPV",
        "desc": "See its status, target, indicated amounts and checklist progress. The iCapOS admin team manages SPVs.",
        "tap": {
          "kind": "watch",
          "label": "SPV opportunity status"
        },
        "then": "SPV cards listed"
      },
      {
        "title": "Follow closing progress",
        "desc": "Watch the progress rail and the closing summary on each SPV.",
        "tap": {
          "kind": "watch",
          "label": "Final operational closing"
        },
        "then": "Closing summary line"
      }
    ]
  },
  {
    "key": "capital-raise",
    "routes": [
      "/founder/capital-raise"
    ],
    "title": "How your capital raise page works",
    "steps": [
      {
        "title": "Open the interest breakdown",
        "desc": "See the non-binding interest investors have indicated so far.",
        "tap": {
          "kind": "button",
          "label": "View breakdown"
        },
        "then": "Breakdown panel opens"
      },
      {
        "title": "Check your investor pipeline",
        "desc": "Review interest, intro requests and saved deals tied to your listing.",
        "tap": {
          "kind": "watch",
          "label": "Investor pipeline"
        },
        "then": "Investor cards appear"
      },
      {
        "title": "Run the round health check",
        "desc": "Get an AI assessment of your round with suggested next steps.",
        "tap": {
          "kind": "button",
          "label": "Analyze my round →"
        },
        "then": "Health grade appears"
      },
      {
        "title": "Find the round calculator",
        "desc": "The round structure calculator now lives in Preparation, under Analyzers.",
        "tap": {
          "kind": "link",
          "label": "Open in Analyzers"
        },
        "then": "Round structure page opens"
      }
    ]
  },
  {
    "key": "investor-update",
    "routes": [
      "/founder/investor-update"
    ],
    "title": "How the investor update builder works",
    "steps": [
      {
        "title": "Pick your company stage",
        "desc": "Choose the stage that matches your raise for tailored guidance.",
        "tap": {
          "kind": "button",
          "label": "Seed"
        },
        "then": "Stage tips update"
      },
      {
        "title": "Write each update section",
        "desc": "Start with a one-line headline, then fill in the other sections.",
        "tap": {
          "kind": "field",
          "label": "One-line headline"
        },
        "then": "Section tips appear"
      },
      {
        "title": "Preview your update",
        "desc": "Open the preview to read the full update as one message.",
        "tap": {
          "kind": "button",
          "label": "Preview update"
        },
        "then": "Preview opens"
      },
      {
        "title": "Copy the finished update",
        "desc": "Copy it once the required sections are filled, then paste into your email.",
        "tap": {
          "kind": "button",
          "label": "Copy full update"
        },
        "then": "Copied to clipboard"
      }
    ]
  },
  {
    "key": "milestones",
    "routes": [
      "/founder/milestones"
    ],
    "title": "How your milestones page works",
    "steps": [
      {
        "title": "Check your overall progress",
        "desc": "See how many milestones you have achieved so far.",
        "tap": {
          "kind": "watch",
          "label": "milestones achieved"
        },
        "then": "Progress bar shown"
      },
      {
        "title": "Browse each category",
        "desc": "Each group lists milestones with a short description of what counts.",
        "tap": {
          "kind": "watch",
          "label": "Overall progress"
        },
        "then": "Category cards shown"
      },
      {
        "title": "Spot what is still open",
        "desc": "Milestones marked Not started show a progress bar when one applies.",
        "tap": {
          "kind": "watch",
          "label": "Not started"
        },
        "then": "Open milestones listed"
      }
    ]
  },
  {
    "key": "analytics",
    "routes": [
      "/founder/analytics"
    ],
    "title": "How your analytics page works",
    "steps": [
      {
        "title": "Open a metric card",
        "desc": "Tap a card to see the details behind that number.",
        "tap": {
          "kind": "button",
          "label": "View breakdown →"
        },
        "then": "Detail panel opens"
      },
      {
        "title": "Read your marketplace funnel",
        "desc": "See how investors move through your listing.",
        "tap": {
          "kind": "watch",
          "label": "Marketplace funnel"
        },
        "then": "Funnel steps shown"
      },
      {
        "title": "Track engagement over time",
        "desc": "Watch the trend chart to see whether activity is growing.",
        "tap": {
          "kind": "watch",
          "label": "Engagement trend"
        },
        "then": "Trend chart shown"
      },
      {
        "title": "Follow up with investors",
        "desc": "Jump to your investors list to act on what you see.",
        "tap": {
          "kind": "link",
          "label": "Manage investors"
        },
        "then": "Investors page opens"
      }
    ]
  },
  {
    "key": "inbox",
    "routes": [
      "/founder/inbox",
      "/founder/messages"
    ],
    "title": "How your inbox and messages work",
    "steps": [
      {
        "title": "Connect your Google account",
        "desc": "Link Google so iCapOS can show your Gmail inbox.",
        "tap": {
          "kind": "link",
          "label": "Connect Google"
        },
        "then": "Google sign in opens"
      },
      {
        "title": "Open your inbox folder",
        "desc": "Pick a folder to read mail without leaving iCapOS.",
        "tap": {
          "kind": "button",
          "label": "Inbox"
        },
        "then": "Your emails listed"
      },
      {
        "title": "Find investor conversations",
        "desc": "On Messages, threads open when an investor requests an intro or follow-up.",
        "tap": {
          "kind": "watch",
          "label": "Inbox"
        },
        "then": "Thread list shown"
      },
      {
        "title": "Write your message",
        "desc": "Type a professional note in the open conversation.",
        "tap": {
          "kind": "field",
          "label": "Send message"
        },
        "then": "Text box fills"
      },
      {
        "title": "Send it in the thread",
        "desc": "Post your note to the investor in this conversation.",
        "tap": {
          "kind": "button",
          "label": "Send"
        },
        "then": "Message joins thread"
      }
    ]
  },
  {
    "key": "calendar",
    "routes": [
      "/founder/calendar",
      "/founder/schedule"
    ],
    "title": "How your calendar and scheduling work",
    "steps": [
      {
        "title": "Connect your Google account",
        "desc": "Link Google to sync events with your calendar.",
        "tap": {
          "kind": "link",
          "label": "Connect Google"
        },
        "then": "Google sign in opens"
      },
      {
        "title": "Add a new event",
        "desc": "Fill in a title and details, then save the event.",
        "tap": {
          "kind": "button",
          "label": "New event"
        },
        "then": "Event form opens"
      },
      {
        "title": "Switch to the agenda view",
        "desc": "Read your upcoming events as a simple list.",
        "tap": {
          "kind": "button",
          "label": "Agenda"
        },
        "then": "Event list shown"
      },
      {
        "title": "Set your availability",
        "desc": "On Scheduling, choose your timezone, meeting lengths and open hours.",
        "tap": {
          "kind": "button",
          "label": "Save availability"
        },
        "then": "Availability saved message"
      },
      {
        "title": "Copy your booking link",
        "desc": "Share this link so people can pick a time with you.",
        "tap": {
          "kind": "button",
          "label": "Copy"
        },
        "then": "Copied! shows briefly"
      }
    ]
  },
  {
    "key": "tasks",
    "routes": [
      "/founder/tasks"
    ],
    "title": "How your tasks page works",
    "steps": [
      {
        "title": "Start a new task",
        "desc": "Open the quick add form at the top of your list.",
        "tap": {
          "kind": "button",
          "label": "+ Add task"
        },
        "then": "Quick add form opens"
      },
      {
        "title": "Name the task",
        "desc": "Type a clear title, then set priority or due date if you like.",
        "tap": {
          "kind": "field",
          "label": "Task title…"
        },
        "then": "Title fills in"
      },
      {
        "title": "Save the task",
        "desc": "Add it to your list so you can track it.",
        "tap": {
          "kind": "button",
          "label": "Save"
        },
        "then": "Task appears in list"
      },
      {
        "title": "Mark it complete",
        "desc": "Tick the task when the work is finished.",
        "tap": {
          "kind": "check",
          "label": "Mark complete"
        },
        "then": "Task moves to Done"
      },
      {
        "title": "Review finished work",
        "desc": "Switch tabs to see everything you have completed.",
        "tap": {
          "kind": "button",
          "label": "Done"
        },
        "then": "Completed tasks shown"
      }
    ]
  },
  {
    "key": "billing",
    "routes": [
      "/founder/settings/billing"
    ],
    "title": "How billing and subscription works",
    "steps": [
      {
        "title": "Check your current plan",
        "desc": "See your plan, subscription status and billing status.",
        "tap": {
          "kind": "watch",
          "label": "Current plan"
        },
        "then": "Plan details shown"
      },
      {
        "title": "Look at upgrade options",
        "desc": "Open the upgrade page to compare plans.",
        "tap": {
          "kind": "link",
          "label": "Upgrade plan"
        },
        "then": "Upgrade page opens"
      },
      {
        "title": "Choose a billing cycle",
        "desc": "For Premium by bank wire, pick monthly or quarterly.",
        "tap": {
          "kind": "button",
          "label": "Monthly"
        },
        "then": "Cycle highlighted"
      },
      {
        "title": "Request a wire invoice",
        "desc": "Ask for an invoice that comes with wire instructions.",
        "tap": {
          "kind": "button",
          "label": "Request wire invoice"
        },
        "then": "Invoice and instructions shown"
      },
      {
        "title": "Download your invoice",
        "desc": "Save the invoice as a PDF for your records.",
        "tap": {
          "kind": "link",
          "label": "Download PDF"
        },
        "then": "PDF downloads"
      }
    ]
  }
];
