/**
 * CURATED REFERENCE SOURCE REGISTRY
 *
 * Trusted sources by knowledge domain. Each entry describes:
 * - What to fetch and how
 * - Refresh cadence
 * - Quality tier
 * - Whether automated fetch is feasible or manual upload is required
 *
 * MANUAL_ONLY sources (e.g. Mauboussin PDFs, CFA standards) must be uploaded
 * via the existing `npm run ingest:file` pipeline and tagged with the
 * appropriate knowledge_domain on ingestion.
 */

import type { KnowledgeDomain, RefType } from "../repositories/reference-repository";

export type FetchMethod =
  | "PDF_DOWNLOAD"    // direct PDF URL — download and extract text
  | "HTML_SCRAPE"     // parse HTML page for article/report text
  | "JSON_API"        // structured API response
  | "CSV_DOWNLOAD"    // spreadsheet data (Damodaran XLS/CSV) — extract as metadata_json
  | "MANUAL_ONLY";    // no automated fetch; seed via ingest:file

export type RefreshCadence =
  | "MONTHLY"
  | "QUARTERLY"
  | "ANNUAL"
  | "MANUAL_ONLY";    // only updated when manually triggered

export interface ReferenceSource {
  sourceId: string;
  name: string;
  description: string;
  knowledgeDomain: KnowledgeDomain;
  refType: RefType;
  fetchMethod: FetchMethod;
  url?: string;
  qualityTier: "AUTHORITATIVE" | "HIGH" | "MEDIUM";
  qualityScore: number;  // 0.0–1.0 default for this source
  language: "EN" | "PT" | "BOTH";
  refreshCadence: RefreshCadence;
  tags: string[];
  notes?: string;
}

export const REFERENCE_SOURCES: ReferenceSource[] = [

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // VALUATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    sourceId: "damodaran-country-risk",
    name: "Damodaran — Country Risk Premium & ERP",
    description:
      "Aswath Damodaran's annual country risk premium and equity risk premium data. " +
      "Used for WACC construction in Brazilian and EM company valuations.",
    knowledgeDomain: "VALUATION",
    refType: "DATA",
    fetchMethod: "CSV_DOWNLOAD",
    url: "http://pages.stern.nyu.edu/~adamodar/pc/datasets/ctryprem.csv",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 0.97,
    language: "EN",
    refreshCadence: "ANNUAL",
    tags: ["WACC", "country-risk", "ERP", "Brazil", "EMBI", "Damodaran"],
    notes:
      "Damodaran updates this annually (usually January). Extract Brazil row as metadata_json. " +
      "Key fields: country, ERP, country risk premium, lambda (relative risk). " +
      "The raw CSV has many EM countries — parse Brazil (Baa2/BB+/BB+) specifically.",
  },
  {
    sourceId: "damodaran-industry-betas",
    name: "Damodaran — Industry Betas (Emerging Markets)",
    description:
      "Unlevered and levered beta by industry for emerging market companies. " +
      "Used to estimate beta for comparable-company WACC in Brazilian valuations.",
    knowledgeDomain: "VALUATION",
    refType: "DATA",
    fetchMethod: "CSV_DOWNLOAD",
    url: "http://pages.stern.nyu.edu/~adamodar/pc/datasets/betaEMst.csv",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 0.96,
    language: "EN",
    refreshCadence: "ANNUAL",
    tags: ["beta", "WACC", "industry", "emerging-markets", "Damodaran"],
  },
  {
    sourceId: "damodaran-ebitda-multiples",
    name: "Damodaran — EV/EBITDA Multiples by Sector (Global)",
    description:
      "EV/EBITDA, EV/Sales, P/E, and P/BV multiples by industry globally. " +
      "Used for comparable-company and sector benchmarking.",
    knowledgeDomain: "VALUATION",
    refType: "DATA",
    fetchMethod: "CSV_DOWNLOAD",
    url: "http://pages.stern.nyu.edu/~adamodar/pc/datasets/vebitdaGlobal.csv",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 0.95,
    language: "EN",
    refreshCadence: "ANNUAL",
    tags: ["EV/EBITDA", "multiples", "comparables", "sector", "Damodaran"],
  },
  {
    sourceId: "mauboussin-measuring-moat",
    name: "Mauboussin — Measuring the Moat (Morgan Stanley / Consilient Observer)",
    description:
      "Michael Mauboussin's framework for assessing competitive advantage. " +
      "Identifies five moat types: cost advantages, network effects, switching costs, " +
      "intangible assets, and efficient scale. Includes fade-rate analysis of ROIC.",
    knowledgeDomain: "VALUATION",
    refType: "FRAMEWORK",
    fetchMethod: "MANUAL_ONLY",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 0.99,
    language: "EN",
    refreshCadence: "MANUAL_ONLY",
    tags: [
      "moat", "competitive-advantage", "ROIC", "fade-rate", "Mauboussin",
      "Consilient-Observer", "Morgan-Stanley",
    ],
    notes:
      "Seed manually via `npm run ingest:file`. Tag knowledge_domain=VALUATION, " +
      "ref_type=FRAMEWORK, source_name='Mauboussin / Morgan Stanley Consilient Observer'.",
  },
  {
    sourceId: "mauboussin-capital-allocation",
    name: "Mauboussin — Capital Allocation: Evidence, Analytical Methods, and Assessment Guidance",
    description:
      "Comprehensive framework for evaluating how management allocates capital: " +
      "organic reinvestment, M&A, dividends, buybacks, and balance sheet. " +
      "Includes TSR decomposition and EVA framework.",
    knowledgeDomain: "VALUATION",
    refType: "FRAMEWORK",
    fetchMethod: "MANUAL_ONLY",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 0.99,
    language: "EN",
    refreshCadence: "MANUAL_ONLY",
    tags: [
      "capital-allocation", "TSR", "EVA", "ROIC", "buybacks", "M&A",
      "dividends", "Mauboussin", "Consilient-Observer",
    ],
  },
  {
    sourceId: "mauboussin-roic-calculation",
    name: "Mauboussin — Calculating Return on Invested Capital",
    description:
      "Step-by-step methodology for ROIC calculation with adjustments for " +
      "operating leases, R&D capitalisation, goodwill, and other balance sheet items. " +
      "The definitive reference for computing ROIC correctly.",
    knowledgeDomain: "VALUATION",
    refType: "FRAMEWORK",
    fetchMethod: "MANUAL_ONLY",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 0.99,
    language: "EN",
    refreshCadence: "MANUAL_ONLY",
    tags: [
      "ROIC", "NOPAT", "invested-capital", "calculation", "adjustments",
      "operating-leases", "R&D", "goodwill", "Mauboussin",
    ],
  },
  {
    sourceId: "mauboussin-tsr-decomposition",
    name: "Mauboussin — Total Shareholder Return: Measurement, Drivers, and Uses",
    description:
      "Framework for decomposing TSR into earnings growth, multiple expansion, " +
      "dividend yield, and net buyback yield. Separates sentiment from fundamental value creation.",
    knowledgeDomain: "VALUATION",
    refType: "FRAMEWORK",
    fetchMethod: "MANUAL_ONLY",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 0.99,
    language: "EN",
    refreshCadence: "MANUAL_ONLY",
    tags: [
      "TSR", "total-shareholder-return", "EPS-growth", "multiple-expansion",
      "dividend", "buyback", "Mauboussin",
    ],
  },
  {
    sourceId: "mauboussin-base-rate-book",
    name: "Mauboussin — The Base Rate Book",
    description:
      "Base rates for sales growth, operating leverage, ROIC, and margin by sector. " +
      "Used to calibrate financial model assumptions against historical reality.",
    knowledgeDomain: "VALUATION",
    refType: "DATA",
    fetchMethod: "MANUAL_ONLY",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 0.98,
    language: "EN",
    refreshCadence: "MANUAL_ONLY",
    tags: [
      "base-rates", "sales-growth", "ROIC", "margin", "sector",
      "historical", "Mauboussin",
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // IR PRACTICE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    sourceId: "niri-standards",
    name: "NIRI — Standards of Practice for Investor Relations",
    description:
      "National Investor Relations Institute standards covering disclosure, " +
      "equity story, investor targeting, and IR best practices.",
    knowledgeDomain: "IR_PRACTICE",
    refType: "STANDARD",
    fetchMethod: "MANUAL_ONLY",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 0.97,
    language: "EN",
    refreshCadence: "QUARTERLY",
    tags: ["NIRI", "IR-standards", "disclosure", "best-practices"],
  },
  {
    sourceId: "airi-standards",
    name: "AIRI — Normas de Melhores Práticas de RI",
    description:
      "Associação dos Analistas e Profissionais de Investimento do Mercado de Capitais " +
      "(AIRI) best practice standards for IR in Brazil. Covers CVM compliance, " +
      "investor communication, and earnings disclosure.",
    knowledgeDomain: "IR_PRACTICE",
    refType: "STANDARD",
    fetchMethod: "MANUAL_ONLY",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 0.96,
    language: "PT",
    refreshCadence: "QUARTERLY",
    tags: ["AIRI", "Brazil", "RI", "melhores-práticas", "CVM"],
  },
  {
    sourceId: "ir-society-annual-report",
    name: "IR Society UK — Best Practice Annual Report Guidance",
    description:
      "Annual report quality framework from the UK IR Society. Covers strategic narrative, " +
      "financial review, governance, and investor communication standards.",
    knowledgeDomain: "IR_PRACTICE",
    refType: "GUIDE",
    fetchMethod: "MANUAL_ONLY",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 0.93,
    language: "EN",
    refreshCadence: "ANNUAL",
    tags: ["IR-Society", "annual-report", "strategic-narrative", "best-practices"],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REGULATORY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    sourceId: "cvm-instrucao-358",
    name: "CVM — Instrução CVM nº 358/2002 (Divulgação de Ato ou Fato Relevante)",
    description:
      "Core Brazilian securities regulation on material fact disclosure. " +
      "Defines what constitutes a material fact, timing of disclosure, and procedures " +
      "for trading suspensions. The primary compliance reference for Fatos Relevantes.",
    knowledgeDomain: "REGULATORY",
    refType: "REGULATORY_TEXT",
    fetchMethod: "PDF_DOWNLOAD",
    url: "https://conteudo.cvm.gov.br/export/sites/cvm/legislacao/instrucoes/anexos/300/inst358consolid.pdf",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 1.0,
    language: "PT",
    refreshCadence: "MONTHLY",
    tags: ["CVM", "Instrução-358", "fato-relevante", "material-fact", "Brazil", "regulatory"],
  },
  {
    sourceId: "cvm-instrucao-480",
    name: "CVM — Instrução CVM nº 480/2009 (Registro de Emissores)",
    description:
      "Registration requirements for public companies in Brazil. Covers periodic reporting " +
      "obligations (DFP, ITR, FRE), document standards, and CVM filing procedures.",
    knowledgeDomain: "REGULATORY",
    refType: "REGULATORY_TEXT",
    fetchMethod: "PDF_DOWNLOAD",
    url: "https://conteudo.cvm.gov.br/export/sites/cvm/legislacao/instrucoes/anexos/400/inst480consolid.pdf",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 1.0,
    language: "PT",
    refreshCadence: "MONTHLY",
    tags: ["CVM", "Instrução-480", "DFP", "ITR", "FRE", "Brazil", "periodic-reporting"],
  },
  {
    sourceId: "cvm-resolucao-44",
    name: "CVM — Resolução CVM nº 44/2021 (Informações Periódicas e Eventuais)",
    description:
      "Regulatory framework for periodic and event-driven disclosures by public issuers in Brazil. " +
      "Supersedes earlier instructions on forms and filing requirements.",
    knowledgeDomain: "REGULATORY",
    refType: "REGULATORY_TEXT",
    fetchMethod: "MANUAL_ONLY",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 1.0,
    language: "PT",
    refreshCadence: "MONTHLY",
    tags: ["CVM", "Resolução-44", "Brazil", "regulatory", "periodic-disclosure"],
  },
  {
    sourceId: "sec-reg-fd",
    name: "SEC — Regulation FD (Fair Disclosure)",
    description:
      "SEC rule prohibiting selective disclosure of material non-public information. " +
      "Requires simultaneous public disclosure when sharing material information with " +
      "market professionals. Critical for dual-listed companies and US investor relations.",
    knowledgeDomain: "REGULATORY",
    refType: "REGULATORY_TEXT",
    fetchMethod: "MANUAL_ONLY",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 1.0,
    language: "EN",
    refreshCadence: "QUARTERLY",
    tags: ["SEC", "Reg-FD", "selective-disclosure", "MNPI", "US", "dual-listed"],
  },
  {
    sourceId: "b3-novo-mercado",
    name: "B3 — Regulamento do Novo Mercado",
    description:
      "B3 Novo Mercado listing rules: governance standards, tag-along rights, " +
      "free float requirements, audit committee composition, and disclosure obligations " +
      "above and beyond CVM requirements.",
    knowledgeDomain: "REGULATORY",
    refType: "REGULATORY_TEXT",
    fetchMethod: "MANUAL_ONLY",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 0.99,
    language: "PT",
    refreshCadence: "ANNUAL",
    tags: ["B3", "Novo-Mercado", "corporate-governance", "listing-rules", "Brazil"],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ACCOUNTING
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    sourceId: "ias-34",
    name: "IASB — IAS 34 Interim Financial Reporting",
    description:
      "International standard governing the content and form of interim financial reports " +
      "(quarterly and semi-annual). Required for ITR filings in Brazil. " +
      "Covers condensed financial statements, selected notes, and management commentary.",
    knowledgeDomain: "ACCOUNTING",
    refType: "STANDARD",
    fetchMethod: "MANUAL_ONLY",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 1.0,
    language: "EN",
    refreshCadence: "ANNUAL",
    tags: ["IAS-34", "IFRS", "interim-reporting", "ITR", "quarterly"],
  },
  {
    sourceId: "ias-1",
    name: "IASB — IAS 1 Presentation of Financial Statements",
    description:
      "IFRS standard for the presentation of financial statements. Defines the structure, " +
      "minimum content, and general principles for balance sheet, income statement, " +
      "statement of changes in equity, and cash flow statement.",
    knowledgeDomain: "ACCOUNTING",
    refType: "STANDARD",
    fetchMethod: "MANUAL_ONLY",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 1.0,
    language: "EN",
    refreshCadence: "ANNUAL",
    tags: ["IAS-1", "IFRS", "financial-statements", "presentation"],
  },
  {
    sourceId: "ifrs-8",
    name: "IASB — IFRS 8 Operating Segments",
    description:
      "IFRS standard for segment reporting. Defines how to identify and report operating " +
      "segments based on the management approach. Critical for earnings presentations " +
      "and investor day segment breakdowns.",
    knowledgeDomain: "ACCOUNTING",
    refType: "STANDARD",
    fetchMethod: "MANUAL_ONLY",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 1.0,
    language: "EN",
    refreshCadence: "ANNUAL",
    tags: ["IFRS-8", "segment-reporting", "operating-segments", "management-approach"],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STRATEGY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    sourceId: "mckinsey-quarterly",
    name: "McKinsey Quarterly — Strategy & Corporate Finance",
    description:
      "McKinsey's flagship publication covering strategic frameworks, value creation, " +
      "corporate finance, and industry trends. Key reference for strategic positioning analysis.",
    knowledgeDomain: "STRATEGY",
    refType: "FRAMEWORK",
    fetchMethod: "HTML_SCRAPE",
    url: "https://www.mckinsey.com/quarterly/overview",
    qualityTier: "HIGH",
    qualityScore: 0.88,
    language: "EN",
    refreshCadence: "MONTHLY",
    tags: ["McKinsey", "strategy", "corporate-finance", "value-creation"],
  },
  {
    sourceId: "bcg-henderson-institute",
    name: "BCG Henderson Institute — Business Strategy Research",
    description:
      "BCG's research arm covering competitive strategy, industry dynamics, and " +
      "business transformation frameworks.",
    knowledgeDomain: "STRATEGY",
    refType: "FRAMEWORK",
    fetchMethod: "HTML_SCRAPE",
    url: "https://www.bcg.com/publications",
    qualityTier: "HIGH",
    qualityScore: 0.85,
    language: "EN",
    refreshCadence: "MONTHLY",
    tags: ["BCG", "strategy", "competitive-dynamics", "transformation"],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MACRO
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    sourceId: "imf-weo",
    name: "IMF — World Economic Outlook (Brazil chapter)",
    description:
      "IMF World Economic Outlook data and projections for Brazil: GDP growth, " +
      "inflation, current account, fiscal balance. Used for macro scenario framing in " +
      "earnings narrative and investor presentations.",
    knowledgeDomain: "MACRO",
    refType: "DATA",
    fetchMethod: "MANUAL_ONLY",
    url: "https://www.imf.org/en/Publications/WEO",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 0.97,
    language: "EN",
    refreshCadence: "QUARTERLY",
    tags: ["IMF", "WEO", "Brazil", "GDP", "inflation", "macro"],
  },
  {
    sourceId: "ipeadata-brazil-macro",
    name: "IPEADATA — Brazilian Macro Indicators",
    description:
      "IPEA's database of Brazilian macroeconomic indicators: IPCA, SELIC, exchange rate, " +
      "GDP, industrial production, employment. Used for macro context in IR communications.",
    knowledgeDomain: "MACRO",
    refType: "DATA",
    fetchMethod: "JSON_API",
    url: "http://www.ipeadata.gov.br/api/odata4/Metadados",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 0.95,
    language: "PT",
    refreshCadence: "MONTHLY",
    tags: ["IPEADATA", "Brazil", "IPCA", "SELIC", "GDP", "macro", "IPEA"],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ESG STANDARDS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    sourceId: "gri-standards",
    name: "GRI — Global Reporting Initiative Standards",
    description:
      "International standards for sustainability reporting. GRI 1, 2, 3 (Universal), " +
      "plus sector-specific standards. Used for ESG disclosure guidance and investor Q&A.",
    knowledgeDomain: "ESG_STANDARDS",
    refType: "STANDARD",
    fetchMethod: "MANUAL_ONLY",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 0.97,
    language: "EN",
    refreshCadence: "ANNUAL",
    tags: ["GRI", "ESG", "sustainability-reporting", "disclosure"],
  },
  {
    sourceId: "tcfd-framework",
    name: "TCFD — Task Force on Climate-related Financial Disclosures Framework",
    description:
      "TCFD recommendations for climate-related financial disclosures across governance, " +
      "strategy, risk management, and metrics. Increasingly required by B3 and CVM.",
    knowledgeDomain: "ESG_STANDARDS",
    refType: "FRAMEWORK",
    fetchMethod: "MANUAL_ONLY",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 0.97,
    language: "EN",
    refreshCadence: "ANNUAL",
    tags: ["TCFD", "climate", "ESG", "governance", "risk-management", "CVM"],
  },
  {
    sourceId: "sasb-standards",
    name: "SASB — Sustainability Accounting Standards Board (sector-specific)",
    description:
      "SASB sector-specific disclosure standards: industry-relevant ESG metrics, " +
      "material topics, and accounting metrics for sustainability reporting.",
    knowledgeDomain: "ESG_STANDARDS",
    refType: "STANDARD",
    fetchMethod: "MANUAL_ONLY",
    qualityTier: "AUTHORITATIVE",
    qualityScore: 0.95,
    language: "EN",
    refreshCadence: "ANNUAL",
    tags: ["SASB", "ESG", "sector", "material-topics", "sustainability"],
  },
];

/**
 * Filter sources by refresh cadence — used by the scheduler.
 */
export function getSourcesByCadence(cadence: "MONTHLY" | "QUARTERLY" | "ANNUAL"): ReferenceSource[] {
  return REFERENCE_SOURCES.filter(
    (s) => s.refreshCadence === cadence && s.fetchMethod !== "MANUAL_ONLY"
  );
}

/**
 * Find a source by ID.
 */
export function findSource(sourceId: string): ReferenceSource | undefined {
  return REFERENCE_SOURCES.find((s) => s.sourceId === sourceId);
}
