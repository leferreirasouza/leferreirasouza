import { describe, it, expect } from "vitest";
import { COMPLIANCE_RULES } from "../../src/compliance/rules";
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

const findRule = (code: string) => COMPLIANCE_RULES.find((r) => r.code === code)!;

describe("CR-001: Guidance without approval", () => {
  const rule = findRule("CR-001");

  it("blocks guidance language in output without approval flag", () => {
    const content = `{"output": "guidance for 2026: EBITDA of BRL 1.2 billion"}`;
    expect(rule.test(content, mockCtx)).toBe(true);
  });

  it("passes when guidanceApproved flag is present", () => {
    const content = `{"output": "2026 guidance revised", "guidanceApproved":true}`;
    expect(rule.test(content, mockCtx)).toBe(false);
  });

  it("passes content with no guidance language", () => {
    const content = `{"output": "Revenue grew 15% YoY driven by volume"}`;
    expect(rule.test(content, mockCtx)).toBe(false);
  });
});

describe("CR-003: Missing safe harbor", () => {
  const rule = findRule("CR-003");

  it("flags FLS without safe harbor", () => {
    const content = `The company will achieve revenue growth of 20% in 2026.`;
    expect(rule.test(content, mockCtx)).toBe(true);
  });

  it("passes FLS with safe harbor language", () => {
    const content = `The company will achieve revenue growth of 20% in 2026.
This document contains forward-looking statements that involve risks and uncertainties.`;
    expect(rule.test(content, mockCtx)).toBe(false);
  });

  it("passes content with no FLS", () => {
    const content = `Revenue was BRL 1.2 billion in Q4 2025.`;
    expect(rule.test(content, mockCtx)).toBe(false);
  });
});

describe("CR-005: Prohibited language in external content", () => {
  const rule = findRule("CR-005");

  it("flags 'guarantee' in PUBLIC-classified content", () => {
    const content = `{"classification":"PUBLIC","text":"We guarantee our investors a return of 15%."}`;
    expect(rule.test(content, mockCtx)).toBe(true);
  });

  it("passes 'guarantee' in INTERNAL_APPROVED content", () => {
    const content = `{"classification":"INTERNAL_APPROVED","text":"We guarantee our internal model is correct."}`;
    expect(rule.test(content, mockCtx)).toBe(false);
  });
});

describe("CR-006: MNPI indicator", () => {
  const rule = findRule("CR-006");

  it("blocks content with MNPI language", () => {
    const content = `This is confidential — not yet announced merger with TargetCo.`;
    expect(rule.test(content, mockCtx)).toBe(true);
  });

  it("passes clean content", () => {
    const content = `Revenue grew 15% year-over-year as reported in our Q4 2025 results.`;
    expect(rule.test(content, mockCtx)).toBe(false);
  });
});
