// The five masters installed at launch, with their field maps. Field text was
// read from the BLANK masters in Google Drive (highlighted and parenthesized
// blanks), and each map is verified against its file in master-seeds.test.ts.
// Advisory Engagement Agreement and NDA have no master yet (decision Oct 2, 2026).

import type { FieldMatch, FieldType, SignatureAnchors, TemplateKind, TemplateSubtype } from "./types";
import { MASTER_BASE64 as CN } from "./masters/convertible-note";
import { MASTER_BASE64 as SAFE } from "./masters/safe";
import { MASTER_BASE64 as SERIES_A } from "./masters/series-a";
import { MASTER_BASE64 as DDSA } from "./masters/dd-services-agreement";
import { MASTER_BASE64 as DDSA_3MO } from "./masters/dd-services-agreement-3mo";
import { MASTER_BASE64 as DDSA_STOCK_CASH } from "./masters/dd-services-agreement-stock-cash";

export type SeedField = { token: string; label: string; type: FieldType; required: boolean; default_value: string | null; position_ref: FieldMatch[] };
export type MasterSeed = {
  key: string;
  name: string;
  kind: TemplateKind;
  subtype: TemplateSubtype;
  filename: string;
  base64: string;
  entityKey: "venture" | "advisory";
  entityMatch: string;
  hasExpiry: boolean;
  anchors: SignatureAnchors;
  fields: SeedField[];
};

const DDSA_FIELDS: SeedField[] = [
  {
    "token": "date",
    "label": "Date",
    "type": "date",
    "required": true,
    "default_value": null,
    "position_ref": [
      {
        "find": "(DATE)"
      }
    ]
  },
  {
    "token": "service_fee_words",
    "label": "Service fee in words",
    "type": "text",
    "required": true,
    "default_value": "Fifty Thousand Dollars",
    "position_ref": [
      {
        "find": "[Fifty Thousand Dollars ($50,000)]",
        "replace": "Fifty Thousand Dollars"
      }
    ]
  },
  {
    "token": "service_fee",
    "label": "Service fee",
    "type": "currency",
    "required": true,
    "default_value": "50,000",
    "position_ref": [
      {
        "find": "($50,000)]",
        "replace": "50,000"
      }
    ]
  },
  {
    "token": "equity_valuation",
    "label": "Valuation cap",
    "type": "currency",
    "required": true,
    "default_value": "10,000,000",
    "position_ref": [
      {
        "find": "($10,000,000) fully diluted",
        "replace": "10,000,000"
      }
    ]
  },
  {
    "token": "advisory_fee",
    "label": "Advisory fee per month",
    "type": "currency",
    "required": true,
    "default_value": "3,500",
    "position_ref": [
      {
        "find": "($3,500)",
        "replace": "3,500"
      }
    ]
  },
  {
    "token": "company_name",
    "label": "Company legal name",
    "type": "text",
    "required": true,
    "default_value": null,
    "position_ref": [
      {
        "find": "[COMPANY]"
      }
    ]
  },
  {
    "token": "company_address",
    "label": "Company address",
    "type": "multiline",
    "required": true,
    "default_value": null,
    "position_ref": [
      {
        "find": "[ADDRESS]"
      }
    ]
  },
  {
    "token": "company_email",
    "label": "Company notice email",
    "type": "text",
    "required": true,
    "default_value": null,
    "position_ref": [
      {
        "find": "[EMAIL]"
      }
    ]
  }
];

export const MASTER_SEEDS: MasterSeed[] = [
  {
    key: "term_sheet_convertible_note",
    name: "Term Sheet, Convertible Note",
    kind: "term_sheet",
    subtype: "convertible_note",
    filename: "iCFO Venture Term Sheet for Convertible Note Financing - BLANK (No due diligence fee).docx",
    base64: CN,
    entityKey: "venture",
    entityMatch: "ICFO VENTURE GROUP, LLC",
    hasExpiry: false,
    anchors: {"prospect": {"party": "{{company_name}}"}, "countersign": [{"party": "{{spv_name}}"}, {"party": "{{issuing_entity}}"}]},
    fields: [
      {
        "token": "spv_name",
        "label": "SPV name",
        "type": "text",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "ICFO (COMPANY) SPV, LLC"
          }
        ]
      },
      {
        "token": "company_name",
        "label": "Company legal name",
        "type": "text",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "(COMPANY)"
          }
        ]
      },
      {
        "token": "date",
        "label": "Date",
        "type": "date",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "(DATE)"
          }
        ]
      },
      {
        "token": "company_state",
        "label": "State of incorporation",
        "type": "text",
        "required": true,
        "default_value": "Delaware",
        "position_ref": [
          {
            "find": "a Delaware corporation",
            "replace": "Delaware"
          }
        ]
      },
      {
        "token": "financing_amount",
        "label": "Amount of financing",
        "type": "currency",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "$0,000,000",
            "replace": "0,000,000"
          }
        ]
      },
      {
        "token": "interest_rate",
        "label": "Interest rate",
        "type": "percent",
        "required": true,
        "default_value": "10.0",
        "position_ref": [
          {
            "find": "(10.0%)",
            "replace": "10.0"
          }
        ]
      },
      {
        "token": "warrant_coverage",
        "label": "Warrant coverage",
        "type": "percent",
        "required": true,
        "default_value": "30",
        "position_ref": [
          {
            "find": "(30)%",
            "replace": "30"
          }
        ]
      },
      {
        "token": "conversion_discount",
        "label": "Conversion discount",
        "type": "percent",
        "required": true,
        "default_value": "20",
        "position_ref": [
          {
            "find": "(20)%",
            "replace": "20"
          }
        ]
      },
      {
        "token": "valuation_cap",
        "label": "Valuation cap",
        "type": "currency",
        "required": true,
        "default_value": "10,000,000",
        "position_ref": [
          {
            "find": "$(10,000,000)",
            "replace": "10,000,000"
          }
        ]
      },
      {
        "token": "qualified_financing",
        "label": "Qualified financing minimum",
        "type": "currency",
        "required": true,
        "default_value": "5,000,000",
        "position_ref": [
          {
            "find": "$(5,000,000)",
            "replace": "5,000,000"
          }
        ]
      }
    ],
  },
  {
    key: "term_sheet_safe",
    name: "Term Sheet, SAFE",
    kind: "term_sheet",
    subtype: "safe",
    filename: "iCFO Venture Term Sheet for SAFE Financing - BLANK (No due diligence fee).docx",
    base64: SAFE,
    entityKey: "venture",
    entityMatch: "ICFO VENTURE GROUP, LLC",
    hasExpiry: false,
    anchors: {"prospect": {"party": "{{company_name}}"}, "countersign": [{"party": "{{spv_name}}"}]},
    fields: [
      {
        "token": "spv_name",
        "label": "SPV name",
        "type": "text",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "ICFO (COMPANY) SPV, LLC"
          }
        ]
      },
      {
        "token": "company_name",
        "label": "Company legal name",
        "type": "text",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "(COMPANY)"
          }
        ]
      },
      {
        "token": "date",
        "label": "Date",
        "type": "date",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "(DATE)"
          }
        ]
      },
      {
        "token": "company_state",
        "label": "State of incorporation",
        "type": "text",
        "required": true,
        "default_value": "Delaware",
        "position_ref": [
          {
            "find": "a Delaware corporation",
            "replace": "Delaware"
          }
        ]
      },
      {
        "token": "financing_amount",
        "label": "Amount of financing",
        "type": "currency",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "$0,000,000",
            "replace": "0,000,000"
          }
        ]
      },
      {
        "token": "offering_period",
        "label": "Offering period",
        "type": "text",
        "required": true,
        "default_value": "four (4)",
        "position_ref": [
          {
            "find": "four (4) months",
            "replace": "four (4)"
          }
        ]
      },
      {
        "token": "valuation_cap",
        "label": "Valuation cap",
        "type": "currency",
        "required": true,
        "default_value": "10,000,000",
        "position_ref": [
          {
            "find": "$(10,000,000)",
            "replace": "10,000,000"
          }
        ]
      },
      {
        "token": "conversion_discount",
        "label": "Discount",
        "type": "percent",
        "required": true,
        "default_value": "20",
        "position_ref": [
          {
            "find": "(20)%",
            "replace": "20"
          }
        ]
      }
    ],
  },
  {
    key: "term_sheet_series_a",
    name: "Term Sheet, Series A Preferred",
    kind: "term_sheet",
    subtype: "series_a",
    filename: "iCFO Venture Term Sheet for Series A Preferred - BLANK (No due diligence fee).docx",
    base64: SERIES_A,
    entityKey: "venture",
    entityMatch: "ICFO VENTURE GROUP, LLC",
    hasExpiry: true,
    anchors: {"prospect": {"party": "{{company_name}}"}, "countersign": [{"party": "{{issuing_entity}}"}]},
    fields: [
      {
        "token": "company_name",
        "label": "Company legal name",
        "type": "text",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "(COMPANY)"
          }
        ]
      },
      {
        "token": "expiration_date",
        "label": "Term sheet expires",
        "type": "date",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "(DATE)",
            "context": "expires on"
          }
        ]
      },
      {
        "token": "date",
        "label": "Date",
        "type": "date",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "(DATE)"
          }
        ]
      },
      {
        "token": "company_state",
        "label": "State of incorporation",
        "type": "text",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "(STATE)"
          }
        ]
      },
      {
        "token": "financing_amount",
        "label": "Amount raised",
        "type": "currency",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "USD $(AMOUNT)",
            "replace": "(AMOUNT)"
          }
        ]
      },
      {
        "token": "pre_money_valuation",
        "label": "Pre money valuation",
        "type": "currency",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "pre-money valuation of $(AMOUNT)",
            "replace": "(AMOUNT)"
          }
        ]
      },
      {
        "token": "post_money_valuation",
        "label": "Post money valuation",
        "type": "currency",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "post-money valuation of $(AMOUNT)",
            "replace": "(AMOUNT)"
          }
        ]
      }
    ],
  },
  {
    key: "dd_services_agreement",
    name: "Due Diligence Services Agreement",
    kind: "services_agreement",
    subtype: null,
    filename: "iCFO Advisory Due Diligence Services Agreement - BLANK (Advisory fee).docx",
    base64: DDSA,
    entityKey: "advisory",
    entityMatch: "ICFO CAPITAL ADVISORY, LLC",
    hasExpiry: false,
    anchors: {"prospect": {"party": "COMPANY:"}, "countersign": [{"party": "{{issuing_entity}}"}]},
    fields: [
      {
        "token": "date",
        "label": "Date",
        "type": "date",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "(DATE)"
          }
        ]
      },
      {
        "token": "service_fee_words",
        "label": "Service fee in words",
        "type": "text",
        "required": true,
        "default_value": "Fifty Thousand Dollars",
        "position_ref": [
          {
            "find": "[Fifty Thousand Dollars ($50,000)]",
            "replace": "Fifty Thousand Dollars"
          }
        ]
      },
      {
        "token": "service_fee",
        "label": "Service fee",
        "type": "currency",
        "required": true,
        "default_value": "50,000",
        "position_ref": [
          {
            "find": "($50,000)]",
            "replace": "50,000"
          }
        ]
      },
      {
        "token": "equity_valuation",
        "label": "Valuation cap",
        "type": "currency",
        "required": true,
        "default_value": "10,000,000",
        "position_ref": [
          {
            "find": "($10,000,000) fully diluted",
            "replace": "10,000,000"
          }
        ]
      },
      {
        "token": "advisory_fee",
        "label": "Advisory fee per month",
        "type": "currency",
        "required": true,
        "default_value": "3,500",
        "position_ref": [
          {
            "find": "($3,500)",
            "replace": "3,500"
          }
        ]
      },
      {
        "token": "company_name",
        "label": "Company legal name",
        "type": "text",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "[COMPANY]"
          }
        ]
      },
      {
        "token": "company_address",
        "label": "Company address",
        "type": "multiline",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "[ADDRESS]"
          }
        ]
      },
      {
        "token": "company_email",
        "label": "Company notice email",
        "type": "text",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "[EMAIL]"
          }
        ]
      }
    ],
  },
  {
    key: "dd_services_agreement_3mo",
    name: "Due Diligence Services Agreement (3 month advisory)",
    kind: "services_agreement",
    subtype: null,
    filename: "iCFO Advisory Due Diligence Services Agreement - BLANK (Advisory fee 3 months).docx",
    base64: DDSA_3MO,
    entityKey: "advisory",
    entityMatch: "ICFO CAPITAL ADVISORY, LLC",
    hasExpiry: false,
    anchors: {"prospect": {"party": "COMPANY:"}, "countersign": [{"party": "{{issuing_entity}}"}]},
    fields: DDSA_FIELDS,
  },
  {
    key: "dd_services_agreement_stock_cash",
    name: "Due Diligence Services Agreement (cash and stock)",
    kind: "services_agreement",
    subtype: null,
    filename: "iCFO Advisory Due Diligence Services Agreement - BLANK (Paid In Stock + Cash).docx",
    base64: DDSA_STOCK_CASH,
    entityKey: "advisory",
    entityMatch: "ICFO CAPITAL ADVISORY, LLC",
    hasExpiry: false,
    anchors: {"prospect": {"party": "COMPANY:"}, "countersign": [{"party": "{{issuing_entity}}"}]},
    fields: [
      {
        "token": "date",
        "label": "Date",
        "type": "date",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "(DATE)"
          }
        ]
      },
      {
        "token": "service_fee_words",
        "label": "Service fee in words",
        "type": "text",
        "required": true,
        "default_value": "Fifty Thousand Dollars",
        "position_ref": [
          {
            "find": "[Fifty Thousand Dollars ($50,000)]",
            "replace": "Fifty Thousand Dollars"
          }
        ]
      },
      {
        "token": "service_fee",
        "label": "Service fee",
        "type": "currency",
        "required": true,
        "default_value": "50,000",
        "position_ref": [
          {
            "find": "($50,000)]",
            "replace": "50,000"
          }
        ]
      },
      {
        "token": "cash_portion",
        "label": "Paid in cash at signing",
        "type": "currency",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "($25,000 / $50,000) in cash",
            "replace": "25,000 / $50,000"
          }
        ]
      },
      {
        "token": "equity_portion",
        "label": "Paid in equity after completion",
        "type": "currency",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "($25,000 / $50,000) in equity",
            "replace": "25,000 / $50,000"
          }
        ]
      },
      {
        "token": "payment_schedule",
        "label": "Payment schedule",
        "type": "text",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "[insert payment schedule]"
          }
        ]
      },
      {
        "token": "equity_valuation",
        "label": "Valuation cap",
        "type": "currency",
        "required": true,
        "default_value": "10,000,000",
        "position_ref": [
          {
            "find": "($10,000,000) fully diluted",
            "replace": "10,000,000"
          }
        ]
      },
      {
        "token": "company_name",
        "label": "Company legal name",
        "type": "text",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "[COMPANY]"
          }
        ]
      },
      {
        "token": "company_address",
        "label": "Company address",
        "type": "multiline",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "[ADDRESS]"
          }
        ]
      },
      {
        "token": "company_email",
        "label": "Company notice email",
        "type": "text",
        "required": true,
        "default_value": null,
        "position_ref": [
          {
            "find": "[EMAIL]"
          }
        ]
      }
    ],
  },
];
