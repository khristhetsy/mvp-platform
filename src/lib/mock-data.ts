export const requiredDocumentTypes = [
  "Pitch deck",
  "Financial model",
  "Cap table",
  "Business plan",
  "Team bios",
  "Legal documents",
  "Corporate documents",
  "Customer contracts",
  "Market research",
];

export const sampleCompany = {
  id: "company-nova-analytics",
  name: "Nova Analytics",
  industry: "AI Infrastructure",
  stage: "Seed",
  location: "Delaware, United States",
  description:
    "Nova Analytics provides audit-ready model monitoring and compliance automation for regulated financial services teams.",
  fundingAmount: "$2,500,000",
  useOfFunds: "Product engineering, enterprise sales, security certifications, and compliance counsel.",
  revenueStage: "Early revenue",
  status: "In admin review",
  readinessScore: 82,
  campaignStatus: "Draft deal page",
  diligenceProgress: "AI report generated",
};

export const sampleDocuments = [
  { name: "Pitch deck", status: "Uploaded", type: "PITCH_DECK" },
  { name: "Financial statements", status: "Uploaded", type: "FINANCIAL_STATEMENTS" },
  { name: "Cap table", status: "Uploaded", type: "CAP_TABLE" },
  { name: "Legal documents", status: "Missing", type: "LEGAL_DOCUMENTS" },
  { name: "Customer contracts", status: "Needs review", type: "CUSTOMER_CONTRACTS" },
];

export const sampleReport = {
  executiveSummary:
    "Nova Analytics is approaching investor-readiness with a clear enterprise problem, early revenue, and a coherent use of funds. The main diligence gaps are legal completeness, customer contract validation, and deeper financial backup.",
  sections: [
    {
      title: "Business overview",
      body: "The company targets regulated financial institutions that need model governance, monitoring, and audit evidence workflows.",
    },
    {
      title: "Financial review",
      body: "Revenue is early but directionally positive. Additional monthly financial statements, forecast assumptions, and customer concentration detail are needed.",
    },
    {
      title: "Market review",
      body: "The market is large and compliance-driven, with competition from observability, governance, and internal tooling vendors.",
    },
    {
      title: "Legal/compliance review",
      body: "Corporate formation materials are present, but securities counsel review and contract assignment terms should be confirmed before publication.",
    },
    {
      title: "Team review",
      body: "The founding team has relevant product and compliance experience. Add advisor agreements and key-person risk mitigations.",
    },
  ],
  riskFlags: [
    "Customer contracts require legal review before document-room release.",
    "Financial projections need support from actual pipeline and conversion assumptions.",
    "Offering materials must be reviewed by securities counsel.",
  ],
  missingDocuments: ["Legal opinion or counsel memo", "Signed customer contracts", "Detailed financial model"],
  recommendedNextSteps: [
    "Request legal document package before approval.",
    "Validate financial model assumptions with analyst review.",
    "Prepare campaign risk disclosures before publishing.",
  ],
};

export const campaigns = [
  {
    id: "nova-analytics",
    slug: "nova-analytics",
    company: sampleCompany,
    problem:
      "Financial institutions struggle to prove AI model oversight to internal risk teams and external regulators.",
    solution:
      "A monitoring and evidence platform that tracks model behavior, policy exceptions, and approval workflows.",
    marketOpportunity:
      "Regulated AI governance spend is increasing as banks and insurers formalize model risk controls.",
    traction: "6 pilots, 2 paid design partners, and $210k in contracted ARR.",
    fundingTarget: "$2,500,000",
    minimumInvestment: "$25,000",
    team: "Former risk, ML platform, and enterprise security operators.",
    riskDisclosures:
      "Early-stage revenue, long enterprise sales cycles, regulatory uncertainty, and competitive platform risk.",
  },
  {
    id: "clearwater-health",
    slug: "clearwater-health",
    company: {
      ...sampleCompany,
      name: "Clearwater Health",
      industry: "Digital Health",
      stage: "Seed",
      readinessScore: 76,
      description:
        "Clearwater Health builds patient intake automation for specialty clinics with insurance-heavy workflows.",
    },
    problem: "Specialty clinics lose staff hours collecting intake data and insurance documentation.",
    solution: "A secure patient workflow layer that automates intake, document collection, and payer routing.",
    marketOpportunity: "Specialty care groups are consolidating and investing in workflow automation.",
    traction: "14 clinic deployments and $38k MRR.",
    fundingTarget: "$1,800,000",
    minimumInvestment: "$10,000",
    team: "Healthcare operators, workflow engineers, and revenue-cycle advisors.",
    riskDisclosures:
      "Healthcare compliance requirements, implementation complexity, and customer concentration risk.",
  },
];

export const deals = [
  {
    slug: "nova-analytics",
    companyName: "Nova Analytics",
    industry: "AI Infrastructure",
    stage: "Seed",
    location: "Delaware, United States",
    fundingTarget: "$2,500,000",
    minimumInvestment: "$25,000",
    readinessScore: 82,
    shortSummary:
      "Audit-ready AI model monitoring and compliance evidence workflows for regulated financial institutions.",
    overview:
      "Nova Analytics helps banks and insurers monitor AI systems, document model governance decisions, and prepare audit evidence for internal risk teams and regulators.",
    problem:
      "Financial institutions are deploying AI faster than risk and compliance teams can document oversight, exceptions, and approval workflows.",
    solution:
      "A secure monitoring and evidence platform that tracks model behavior, policy exceptions, approvals, and audit-ready reporting.",
    marketOpportunity:
      "Regulated AI governance spend is expanding as financial institutions formalize model risk management and compliance operations.",
    traction: "6 pilots, 2 paid design partners, and $210k in contracted ARR.",
    team: "Former risk, ML platform, and enterprise security operators with experience selling into regulated financial services.",
    useOfFunds: "Product engineering, enterprise sales, security certifications, and compliance counsel.",
    diligenceSummary:
      "The company has a clear regulated-market pain point, early commercial validation, and a coherent use of funds. Key diligence work remains around customer contract review, forecast support, and securities counsel review.",
    riskDisclosures:
      "Early-stage revenue, long enterprise sales cycles, regulatory uncertainty, customer concentration, and competitive platform risk.",
    status: "Published",
  },
  {
    slug: "clearwater-health",
    companyName: "Clearwater Health",
    industry: "Digital Health",
    stage: "Seed",
    location: "Austin, Texas",
    fundingTarget: "$1,800,000",
    minimumInvestment: "$10,000",
    readinessScore: 76,
    shortSummary:
      "Patient intake automation for specialty clinics with insurance-heavy workflows and high documentation burden.",
    overview:
      "Clearwater Health automates patient intake, insurance document collection, and payer routing for specialty care groups.",
    problem: "Specialty clinics lose staff hours collecting intake data, medical history, and insurance documentation.",
    solution: "A secure patient workflow layer that automates intake, document collection, and payer routing.",
    marketOpportunity: "Specialty care groups are consolidating and investing in workflow automation to reduce administrative burden.",
    traction: "14 clinic deployments, $38k MRR, and two regional care group pilots.",
    team: "Healthcare operators, workflow engineers, and revenue-cycle advisors.",
    useOfFunds: "Implementation support, integrations, compliance operations, and clinic sales expansion.",
    diligenceSummary:
      "Clearwater shows credible early revenue and implementation traction. Review should focus on HIPAA controls, payer workflow dependencies, and customer concentration.",
    riskDisclosures:
      "Healthcare compliance requirements, implementation complexity, sales cycle risk, and customer concentration risk.",
    status: "Published",
  },
  {
    slug: "ledgergrid",
    companyName: "LedgerGrid",
    industry: "Fintech",
    stage: "Series A",
    location: "New York, New York",
    fundingTarget: "$5,000,000",
    minimumInvestment: "$50,000",
    readinessScore: 88,
    shortSummary:
      "Treasury and cash forecasting infrastructure for multi-entity finance teams at private market operators.",
    overview:
      "LedgerGrid gives finance teams a consolidated operating cash view across bank accounts, entities, and planned capital events.",
    problem: "Multi-entity finance teams still reconcile cash positions across spreadsheets, bank portals, and ERP exports.",
    solution: "A treasury operating system with bank connectivity, scenario planning, approvals, and board-ready reporting.",
    marketOpportunity:
      "Private market operators, venture-backed rollups, and multi-entity platforms need stronger treasury visibility as rates and liquidity risk remain elevated.",
    traction: "$1.1M ARR, 31 customers, and 118% net revenue retention.",
    team: "Former treasury product leaders, fintech infrastructure engineers, and finance operators.",
    useOfFunds: "Enterprise sales, bank integrations, SOC 2 expansion, and implementation capacity.",
    diligenceSummary:
      "LedgerGrid has stronger revenue maturity and customer retention than typical marketplace submissions. Remaining review should validate cohort retention, bank integration dependencies, and security controls.",
    riskDisclosures:
      "Integration dependency, enterprise procurement friction, data security obligations, and competition from treasury incumbents.",
    status: "Published",
  },
];

export const founderPipeline = {
  profileStatus: "Submitted for review",
  documentStatus: "6 of 8 required documents uploaded",
  diligenceProgress: "AI diligence complete, analyst review pending",
  readinessScore: 82,
  campaignStatus: "Deal page drafted, not published",
  nextSteps: [
    "Upload legal counsel memo and final customer contract packet.",
    "Respond to analyst questions on revenue forecast assumptions.",
    "Review risk disclosures before admin publication.",
  ],
};

export const investorActivity = {
  savedDeals: ["LedgerGrid", "Nova Analytics", "Clearwater Health"],
  expressedInterest: ["Nova Analytics"],
  recentlyViewed: ["LedgerGrid", "Clearwater Health"],
};
