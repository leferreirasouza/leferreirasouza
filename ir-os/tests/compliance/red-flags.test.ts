import { describe, it, expect } from "vitest";
import { RED_FLAG_DETECTORS } from "../../src/compliance/red-flags";
import type { AgentContext } from "../../src/types";

const mockCtx: AgentContext = {
  companyId: "test-co",
  ticker: "TEST3",
  exchange: "B3",
  reportingCurrency: "BRL",
  fiscalYearEnd: "12-31",
  currentPeriod: { year: 2025, quarter: 4, label: "4Q25" },
  sessionId: "test-session",
  traceId: "test-trace",
  authorizedDataSources: ["PUBLIC", "INTERNAL_APPROVED"],
  operatingMode: "INTERNAL_ADVISORY",
};

const findDetector = (id: string) =>
  RED_FLAG_DETECTORS.find((d) => d.detectorId === id)!;

describe("RFD-001: Selective disclosure risk", () => {
  const detector = findDetector("RFD-001");

  it("detects 'just between us' phrase", () => {
    const flags = detector.detect("just between us, the results are great", mockCtx);
    expect(flags).toHaveLength(1);
    expect(flags[0].code).toBe("SELECTIVE_DISCLOSURE_RISK");
    expect(flags[0].severity).toBe("BLOCK");
  });

  it("returns no flags for clean content", () => {
    const flags = detector.detect("Our Q4 results were strong, driven by volume growth.", mockCtx);
    expect(flags).toHaveLength(0);
  });
});

describe("RFD-003: Missing safe harbor", () => {
  const detector = findDetector("RFD-003");

  it("detects missing safe harbor on FLS", () => {
    const flags = detector.detect("We expect to grow revenue by 20% in 2026.", mockCtx);
    expect(flags).toHaveLength(1);
    expect(flags[0].code).toBe("MISSING_SAFE_HARBOR");
    expect(flags[0].severity).toBe("CRITICAL");
  });

  it("no flag when safe harbor is present", () => {
    const flags = detector.detect(
      "We expect to grow revenue by 20%. This document contains forward-looking statements.",
      mockCtx
    );
    expect(flags).toHaveLength(0);
  });

  it("no flag for purely historical content", () => {
    const flags = detector.detect("Revenue grew 12% in FY2025.", mockCtx);
    expect(flags).toHaveLength(0);
  });
});

describe("RFD-004: Guidance without approval", () => {
  const detector = findDetector("RFD-004");

  it("detects guidance language without approval flag", () => {
    const flags = detector.detect("Full-year guidance for 2026: EBITDA BRL 2.1bn", mockCtx);
    expect(flags).toHaveLength(1);
    expect(flags[0].code).toBe("GUIDANCE_WITHOUT_APPROVAL");
    expect(flags[0].severity).toBe("BLOCK");
  });

  it("passes guidance with explicit approval marker", () => {
    const flags = detector.detect(
      `Full-year guidance for 2026: EBITDA BRL 2.1bn. "guidanceApproved":true`,
      mockCtx
    );
    expect(flags).toHaveLength(0);
  });
});

describe("RFD-005: MNPI — undisclosed transaction terms", () => {
  const detector = findDetector("RFD-005");

  it("detects acquisition price in non-public content", () => {
    const flags = detector.detect(
      `The acquisition price agreed is BRL 500M, not yet announced.`,
      mockCtx
    );
    expect(flags).toHaveLength(1);
    expect(flags[0].code).toBe("MNPI_INDICATOR");
    expect(flags[0].severity).toBe("BLOCK");
  });

  it("no flag when content is already PUBLIC+PUBLISHED", () => {
    const flags = detector.detect(
      `"classification":"PUBLIC","draftStatus":"PUBLISHED","text":"acquisition price of BRL 500M"`,
      mockCtx
    );
    expect(flags).toHaveLength(0);
  });
});

describe("RFD-006: Prohibited words in external content", () => {
  const detector = findDetector("RFD-006");

  it("detects 'guarantee' in PUBLIC content", () => {
    const flags = detector.detect(
      `"classification":"PUBLIC","text":"we guarantee returns of 15%"`,
      mockCtx
    );
    expect(flags).toHaveLength(1);
    expect(flags[0].code).toBe("PROHIBITED_WORD");
  });

  it("no flag for INTERNAL_APPROVED content", () => {
    const flags = detector.detect(
      `"classification":"INTERNAL_APPROVED","text":"guarantee model accuracy"`,
      mockCtx
    );
    expect(flags).toHaveLength(0);
  });
});
