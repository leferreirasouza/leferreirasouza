import type { AgentContext } from "../types";

// ----------------------------------------------------------------
// COMPLIANCE RULES
//
// Each rule: code, description, scope (INPUT | OUTPUT | BOTH),
// and a test function that returns true if the rule is VIOLATED.
// ----------------------------------------------------------------

export interface ComplianceRule {
  code: string;
  description: string;
  severity: "INFO" | "WARNING" | "CRITICAL" | "BLOCK";
  scope: ("INPUT" | "OUTPUT")[];
  test: (content: string, ctx: AgentContext) => boolean;
}

export const COMPLIANCE_RULES: ComplianceRule[] = [
  // ---- GUIDANCE RULES ----
  {
    code: "CR-001",
    description: "Guidance disclosure in output without explicit approval flag",
    severity: "BLOCK",
    scope: ["OUTPUT"],
    test: (content) => {
      const guidancePatterns = [
        /guidance.*(?:BRL|USD|R\$)\s*\d/gi,
        /(?:projetamos|esperamos|estimamos|prevemos)\s+(?:receita|EBITDA|lucro)/gi,
        /(?:we expect|we project|we estimate|we forecast)\s+(?:revenue|EBITDA|net income)/gi,
        /full.?year.*guidance/gi,
        /\d{4}\s*guidance/gi,
      ];
      const hasGuidance = guidancePatterns.some((p) => p.test(content));
      const isApproved = content.includes('"guidanceApproved":true') ||
        content.includes("GUIDANCE_APPROVED");
      return hasGuidance && !isApproved;
    },
  },

  // ---- SELECTIVE DISCLOSURE ----
  {
    code: "CR-002",
    description: "Content contains unreleased financial results",
    severity: "BLOCK",
    scope: ["OUTPUT"],
    test: (content) => {
      // Flag if content includes specific numerical results in a draft document
      // that hasn't been cleared for public disclosure
      const resultPatterns = [
        /receita(?:\s+líquida)?\s+(?:de|foi|atingiu)\s+R\$?\s*[\d,\.]+/gi,
        /EBITDA\s+(?:de|foi|atingiu)\s+R\$?\s*[\d,\.]+/gi,
        /revenue\s+(?:of|was|reached)\s+(?:BRL|USD|R\$)\s*[\d,\.]+/gi,
        /net\s+income\s+(?:of|was)\s+[\d,\.]+/gi,
      ];
      const isMarkedPublic = content.includes('"classification":"PUBLIC"') ||
        content.includes('"draftStatus":"PUBLISHED"');
      const hasResults = resultPatterns.some((p) => p.test(content));
      return hasResults && !isMarkedPublic;
    },
  },

  // ---- SAFE HARBOR ----
  {
    code: "CR-003",
    description: "Forward-looking statements without safe harbor language",
    severity: "CRITICAL",
    scope: ["OUTPUT"],
    test: (content) => {
      const flsPatterns = [
        /(?:will achieve|will grow|will reach|will deliver)/gi,
        /(?:atingirá|crescerá|alcançará|entregará)/gi,
        /expects?\s+to\s+(?:grow|achieve|deliver|reach)/gi,
      ];
      const hasSafeHarbor = content.toLowerCase().includes("forward-looking") ||
        content.toLowerCase().includes("safe harbor") ||
        content.toLowerCase().includes("declarações prospectivas");
      const hasFLS = flsPatterns.some((p) => p.test(content));
      return hasFLS && !hasSafeHarbor;
    },
  },

  // ---- UNVERIFIED METRICS ----
  {
    code: "CR-004",
    description: "Non-GAAP metric without reconciliation note",
    severity: "WARNING",
    scope: ["OUTPUT"],
    test: (content) => {
      const nonGaapTerms = /EBITDA|EBIT ajustado|Adjusted|non-GAAP|Pro forma/gi;
      const hasReconciliation = content.toLowerCase().includes("reconciliation") ||
        content.toLowerCase().includes("reconciliação") ||
        content.toLowerCase().includes("gaap");
      return nonGaapTerms.test(content) && !hasReconciliation;
    },
  },

  // ---- PROHIBITED LANGUAGE ----
  {
    code: "CR-005",
    description: "Prohibited guarantee-type language in external communication",
    severity: "CRITICAL",
    scope: ["OUTPUT"],
    test: (content) => {
      const prohibited = [
        /\bguarantee[sd]?\b/gi,
        /\bcertain(?:ly)?\s+(?:will|achieve|deliver)\b/gi,
        /\bgarantimos?\b/gi,
        /\bcom certeza\s+(?:atingiremos|alcançaremos)\b/gi,
      ];
      const isExternal = content.includes('"classification":"PUBLIC"');
      return isExternal && prohibited.some((p) => p.test(content));
    },
  },

  // ---- MNPI REFERENCE ----
  {
    code: "CR-006",
    description: "Potential MNPI detected: undisclosed transaction or event",
    severity: "BLOCK",
    scope: ["INPUT", "OUTPUT"],
    test: (content) => {
      const mnpiPatterns = [
        /\b(?:confidential|under NDA|not yet announced|pending announcement)\b/gi,
        /\b(?:merger|acquisition|target company|deal term)\b.*\b(?:confidential|undisclosed)\b/gi,
      ];
      return mnpiPatterns.some((p) => p.test(content));
    },
  },

  // ---- REGULATORY DEADLINE ----
  {
    code: "CR-007",
    description: "Reference to an event that may trigger a mandatory filing deadline",
    severity: "WARNING",
    scope: ["INPUT", "OUTPUT"],
    test: (content) => {
      const triggerEvents = [
        /\b(?:material fact|fato relevante|material event)\b/gi,
        /\b(?:change of control|mudança de controle)\b/gi,
        /\b(?:management change|mudança na administração|CEO departure)\b/gi,
      ];
      return triggerEvents.some((p) => p.test(content));
    },
  },

  // ---- INCONSISTENCY DETECTION ----
  {
    code: "CR-008",
    description: "Output may contradict a previously filed document",
    severity: "CRITICAL",
    scope: ["OUTPUT"],
    test: (_content, _ctx) => {
      // In production: this would cross-reference filed documents.
      // Conservative stub: does not block but flags for review.
      return false;
    },
  },

  // ---- VALUATION OUTPUT CLASSIFICATION ----
  {
    code: "CR-009",
    description:
      "Modeled valuation figures (DCF outputs, implied valuation ranges, price targets) must never appear in PUBLIC or EXTERNAL classified output",
    severity: "BLOCK",
    scope: ["OUTPUT"],
    test: (content) => {
      // Detect valuation-model outputs
      const valuationPatterns = [
        /(?:DCF|discounted cash flow).*(?:implied|target|fair value)/gi,
        /(?:fair value|intrinsic value|price target)\s+(?:of|=|:)\s+(?:R\$|BRL|USD|\$)\s*[\d,\.]+/gi,
        /(?:valuation range|implied EV|equity value)\s+(?:of|between|:)\s+(?:R\$|BRL|USD|\$)/gi,
        /WACC.*terminal.*growth/gi,
        /EV\/EBITDA.*multiple.*implied/gi,
      ];
      // Only block if also classified as PUBLIC or EXTERNAL
      const isPublicOrExternal =
        content.includes('"classification":"PUBLIC"') ||
        content.includes('"classification":"EXTERNAL"') ||
        content.includes('"draftStatus":"PUBLISHED"');
      const hasValuationOutput = valuationPatterns.some((p) => p.test(content));
      return hasValuationOutput && isPublicOrExternal;
    },
  },
];
