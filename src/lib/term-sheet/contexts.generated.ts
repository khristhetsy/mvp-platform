// GENERATED from the three revised term sheet templates. Do not edit by hand.
import type { TermSheetFormType } from "./types";

/** Text before and after each blank in the template, used to read values back from an uploaded term sheet. */
export const FIELD_CONTEXTS: Record<TermSheetFormType, Record<string, { pre: string; post: string; lab?: string }>> = {
 "convertible_note": {
  "date": {
   "pre": "",
   "post": ""
  },
  "investor": {
   "pre": "key terms of a potential investment by ",
   "post": " (“Investor” or “Holder”) into"
  },
  "company": {
   "pre": "(“Investor” or “Holder”) into ",
   "post": ", a"
  },
  "state": {
   "pre": ", a ",
   "post": " corporation (the “Company”)."
  },
  "amount": {
   "pre": "USD ",
   "post": "",
   "lab": "Amount of Financing:"
  },
  "interest": {
   "pre": "",
   "post": " per annum, until the Notes ar",
   "lab": "Interest Rate:"
  },
  "warrant": {
   "pre": "",
   "post": ". Investors shall be entitled",
   "lab": "Warrant Coverage:"
  },
  "discount": {
   "pre": "er security shall be the lower of (a) a ",
   "post": " discount to the price per sec",
   "lab": "Conversion Price:"
  },
  "cap": {
   "pre": "er security equal to a valuation cap of ",
   "post": " (“Valuation Cap”) divided by",
   "lab": "Conversion Price:"
  },
  "qualified": {
   "pre": "eans an equity financing where at least ",
   "post": " is raised from accredited inv",
   "lab": "Conversion Price:"
  }
 },
 "safe": {
  "date": {
   "pre": "",
   "post": ""
  },
  "investor": {
   "pre": "key terms of a potential investment by ",
   "post": " (“Investor”) into"
  },
  "company": {
   "pre": "(“Investor”) into ",
   "post": ", a Delaware corporation (the"
  },
  "amount": {
   "pre": "USD ",
   "post": "",
   "lab": "SAFE Purchase Amount:"
  },
  "period": {
   "pre": "ereby shall remain open for a period of ",
   "post": " months commencing on the date",
   "lab": "Offering Period:"
  },
  "cap": {
   "pre": "USD $",
   "post": "",
   "lab": "Valuation Cap:"
  },
  "discount": {
   "pre": "",
   "post": "",
   "lab": "Discount Rate:"
  }
 },
 "series_a": {
  "company": {
   "pre": "",
   "post": ""
  },
  "date": {
   "pre": "",
   "post": ""
  },
  "state": {
   "pre": ", a ",
   "post": " corporation (the “Company”)."
  },
  "amount_raised": {
   "pre": "USD $",
   "post": "",
   "lab": "Amount Raised:"
  },
  "premoney": {
   "pre": "a fully-diluted pre-money valuation of $",
   "post": " (which pre-money valuation sh",
   "lab": "Pre-Money Valuation:"
  },
  "postmoney": {
   "pre": "fully‑diluted post-money valuation of $",
   "post": ".",
   "lab": "Pre-Money Valuation:"
  },
  "div": {
   "pre": "eries A Preferred in an amount equal to ",
   "post": " times the original purchase p",
   "lab": "Dividends:"
  },
  "liquidation_preference_75": {
   "pre": "s described above unless the holders of ",
   "post": " of the Series A Preferred ele",
   "lab": "Liquidation Preference:"
  },
  "voting_rights_25": {
   "pre": "a separate class, except (i) so long as ",
   "post": " of the shares of Series A Pre",
   "lab": "Voting Rights:"
  },
  "protective_provisions_25": {
   "pre": "So long as ",
   "post": " shares of Series A Preferred",
   "lab": "Protective Provisions:"
  },
  "protective_provisions_2000000": {
   "pre": "oney following such action would exceed ",
   "post": " other than equipment leases,",
   "lab": "Protective Provisions:"
  },
  "mandatory_conversion_10000000": {
   "pre": "roceeds to the Company of not less than ",
   "post": " (a “QPO”), or (ii) upon the w",
   "lab": "Mandatory Conversion:"
  },
  "warrant_coverage_20": {
   "pre": "es of Series A Preferred stock equal to ",
   "post": " of the number of shares of Se",
   "lab": "Warrant Coverage:"
  },
  "demand_registration_50": {
   "pre": "ublic offering (“IPO”), persons holding ",
   "post": " of the Registrable Securities",
   "lab": "Demand Registration:"
  },
  "registration_on_form_s_30": {
   "pre": "The holders of ",
   "post": " of the Registrable Securities",
   "lab": "Registration on Form S-3:"
  },
  "registration_on_form_s_5million": {
   "pre": "an aggregate offering price of at least ",
   "post": ". There will be no limit on th",
   "lab": "Registration on Form S-3:"
  },
  "piggyback_registration_25": {
   "pre": "oposed to be registered to a minimum of ",
   "post": " on a pro rata basis and to co",
   "lab": "Piggyback Registration:"
  },
  "expenses_10000": {
   "pre": "onable fees and expenses, not to exceed ",
   "post": " per registration, of one spec",
   "lab": "Expenses:"
  },
  "lock_up_5": {
   "pre": "rectors and officers of the Company and ",
   "post": " stockholders agree to the sam",
   "lab": "Lock-up:"
  },
  "management_and_informa_250000": {
   "pre": "ans any Investor who purchases at least ",
   "post": " of Series A Preferred.",
   "lab": "Management and Information Rights:"
  },
  "matters_requiring_pref_1000000": {
   "pre": "r to the Company of assets greater than ",
   "post": "",
   "lab": "Matters Requiring Preferred Director Approval:"
  },
  "employee_stock_options_25": {
   "pre": "ll employee options to vest as follows: ",
   "post": " after one year, with remainin",
   "lab": "Employee Stock Options:"
  },
  "right_of_first_refusal_1": {
   "pre": "by current and future employees holding ",
   "post": " or more of Company Common Sto",
   "lab": "Right of First Refusal/ Right of Co-Sale (Take-Me-Along):"
  },
  "drag_along_1": {
   "pre": "rent and future holders of greater than ",
   "post": " of Common Stock (assuming con",
   "lab": "Drag Along:"
  },
  "drag_along_50": {
   "pre": "quidation Event or transaction in which ",
   "post": " or more of the voting power o",
   "lab": "Drag Along:"
  },
  "founders_stock_50": {
   "pre": "Buyback right/vesting for ",
   "post": " for first",
   "lab": "Founders’ Stock:"
  },
  "founders_stock_12months": {
   "pre": "for first ",
   "post": " after Closing; thereafter, ri",
   "lab": "Founders’ Stock:"
  },
  "investor": {
   "pre": "",
   "post": ""
  }
 }
};
