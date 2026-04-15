import type { AgentContext, RedFlag } from "../types";

// ----------------------------------------------------------------
// RED-FLAG DETECTORS
//
// Stateless detector objects.  Each runs against agent output text
// and returns zero or more RedFlag records.
// ----------------------------------------------------------------

export interface RedFlagDetector {
  detectorId: string;
  description: string;
  detect: (content: string, ctx: AgentContext) => RedFlag[];
}

export const RED_FLAG_DETECTORS: RedFlagDetector[] = [
  {
    detectorId: "RFD-001",
    description: "Selective disclosure risk: material info for specific audience",
    detect: (content) => {
      const flags: RedFlag[] = [];
      // Phrases that suggest telling one investor something not told to market
      const patterns = [
        /(?:just between us|entre nós|confidentially|off the record)/gi,
        /(?:this is not public yet|isso ainda não é público)/gi,
      ];
      for (const pattern of patterns) {
        const match = pattern.exec(content);
        if (match) {
          flags.push({
            code: "SELECTIVE_DISCLOSURE_RISK",
            severity: "BLOCK",
            description: `Phrase "${match[0]}" indicates potential selective disclosure.`,
            triggeredBy: match[0],
            suggestion: "Remove this phrase and ensure all material info is broadly disclosed first.",
          });
        }
      }
      return flags;
    },
  },

  {
    detectorId: "RFD-002",
    description: "Unsupported factual claim (no source cited)",
    detect: (content) => {
      const flags: RedFlag[] = [];
      // Look for specific financial claims without [SOURCE:...] attribution
      const claimPattern = /(?:revenue|EBITDA|net income|receita|lucro)\s+(?:grew|fell|increased|decreased|was)\s+[\d\.]+%?/gi;
      let match;
      while ((match = claimPattern.exec(content)) !== null) {
        if (!content.slice(Math.max(0, match.index - 20), match.index + 200).includes("[SOURCE:")) {
          flags.push({
            code: "UNSUPPORTED_CLAIM",
            severity: "WARNING",
            description: `Financial claim "${match[0].slice(0, 80)}" lacks source attribution.`,
            triggeredBy: match[0].slice(0, 80),
            suggestion: "Add [SOURCE: filingId] inline citation.",
          });
        }
      }
      return flags;
    },
  },

  {
    detectorId: "RFD-003",
    description: "Missing safe-harbor disclaimer on forward-looking content",
    detect: (content) => {
      const flags: RedFlag[] = [];
      const flsKeywords = [
        "will grow", "will achieve", "will reach", "expects to", "projected to",
        "atingirá", "crescerá", "prevemos", "esperamos",
      ];
      const hasFLS = flsKeywords.some((kw) => content.toLowerCase().includes(kw));
      const hasSafeHarbor = content.toLowerCase().includes("forward-looking") ||
        content.toLowerCase().includes("safe harbor") ||
        content.toLowerCase().includes("declarações prospectivas");

      if (hasFLS && !hasSafeHarbor) {
        flags.push({
          code: "MISSING_SAFE_HARBOR",
          severity: "CRITICAL",
          description: "Forward-looking statements detected without safe-harbor disclaimer.",
          triggeredBy: "forward-looking language",
          suggestion: "Append the standard safe-harbor disclaimer before this content is released.",
        });
      }
      return flags;
    },
  },

  {
    detectorId: "RFD-004",
    description: "Guidance language without approval flag",
    detect: (content) => {
      const flags: RedFlag[] = [];
      const guidanceKeywords = [
        "full-year guidance", "annual guidance", "2025 guidance", "2026 guidance",
        "guidance for", "revised guidance", "guidance upgrade",
        "guidance revisada", "projeção para o ano",
      ];
      const hasGuidance = guidanceKeywords.some((kw) => content.toLowerCase().includes(kw));
      const isApproved = content.includes("GUIDANCE_APPROVED") ||
        content.includes('"guidanceApproved":true');

      if (hasGuidance && !isApproved) {
        flags.push({
          code: "GUIDANCE_WITHOUT_APPROVAL",
          severity: "BLOCK",
          description: "Guidance language detected in output without CFO/CEO approval flag.",
          triggeredBy: "guidance keyword",
          suggestion: "Remove guidance language or obtain explicit CFO/CEO/Legal approval before inclusion.",
        });
      }
      return flags;
    },
  },

  {
    detectorId: "RFD-005",
    description: "MNPI indicator: undisclosed transaction terms",
    detect: (content) => {
      const flags: RedFlag[] = [];
      const mnpiTerms = [
        "acquisition price", "deal value", "transaction consideration",
        "preço de aquisição", "valor da transação", "contrapartida",
      ];
      const isNotFiled = !content.includes('"classification":"PUBLIC"') &&
        !content.includes('"draftStatus":"PUBLISHED"');

      if (isNotFiled && mnpiTerms.some((t) => content.toLowerCase().includes(t))) {
        flags.push({
          code: "MNPI_INDICATOR",
          severity: "BLOCK",
          description: "Content contains potential MNPI: undisclosed transaction terms.",
          triggeredBy: "transaction term keyword",
          suggestion: "Escalate to legal immediately. Do not disclose until Fato Relevante is filed.",
        });
      }
      return flags;
    },
  },

  {
    detectorId: "RFD-006",
    description: "Prohibited word in external-classified content",
    detect: (content) => {
      const flags: RedFlag[] = [];
      const isExternal = content.includes('"classification":"PUBLIC"');
      if (!isExternal) return flags;

      const prohibited = ["guarantee", "guaranteed", "certain return", "risk-free"];
      for (const word of prohibited) {
        if (content.toLowerCase().includes(word)) {
          flags.push({
            code: "PROHIBITED_WORD",
            severity: "CRITICAL",
            description: `Prohibited word "${word}" found in external-classified content.`,
            triggeredBy: word,
            suggestion: `Remove "${word}" and replace with qualified language.`,
          });
        }
      }
      return flags;
    },
  },
];
