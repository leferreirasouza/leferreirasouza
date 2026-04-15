import { describe, it, expect } from "vitest";
import {
  classifyContent,
  canPublishExternally,
  minimumApprovalFor,
} from "../../src/compliance/classification";
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

describe("classifyContent", () => {
  it("classifies PROHIBITED content", () => {
    const result = classifyContent(`{"classification":"prohibited","text":"mnpi data"}`, mockCtx);
    expect(result.classification).toBe("PROHIBITED");
    expect(result.requiresHumanApproval).toBe(true);
    expect(result.approvalLevel).toBe("LEGAL_PLUS_CFO");
  });

  it("classifies DRAFT_INTERNAL by default", () => {
    const result = classifyContent(`{"draftstatus":"draft","text":"earnings draft"}`, mockCtx);
    expect(result.classification).toBe("DRAFT_INTERNAL");
    expect(result.requiresHumanApproval).toBe(true);
  });

  it("classifies INTERNAL_APPROVED content", () => {
    const result = classifyContent(`{"classification":"internal_approved"}`, mockCtx);
    expect(result.classification).toBe("INTERNAL_APPROVED");
  });

  it("classifies PUBLIC only when both PUBLIC and PUBLISHED are present", () => {
    const result = classifyContent(
      `{"classification":"PUBLIC","draftStatus":"PUBLISHED"}`,
      mockCtx
    );
    expect(result.classification).toBe("PUBLIC");
  });

  it("defaults to DRAFT_INTERNAL for unclassified content", () => {
    const result = classifyContent("Some text with no classification markers.", mockCtx);
    expect(result.classification).toBe("DRAFT_INTERNAL");
  });
});

describe("canPublishExternally", () => {
  it("allows publishing only for PUBLIC + PUBLISHED", () => {
    expect(canPublishExternally("PUBLIC", "PUBLISHED")).toBe(true);
  });

  it("blocks publishing for APPROVED (not yet PUBLISHED)", () => {
    expect(canPublishExternally("PUBLIC", "APPROVED")).toBe(false);
  });

  it("blocks publishing for DRAFT_INTERNAL", () => {
    expect(canPublishExternally("DRAFT_INTERNAL", "DRAFT")).toBe(false);
  });

  it("blocks publishing for PROHIBITED", () => {
    expect(canPublishExternally("PROHIBITED", "PUBLISHED")).toBe(false);
  });
});

describe("minimumApprovalFor", () => {
  it("requires BOARD for PROHIBITED", () => {
    expect(minimumApprovalFor("PROHIBITED")).toBe("BOARD");
  });

  it("requires CFO for PUBLIC", () => {
    expect(minimumApprovalFor("PUBLIC")).toBe("CFO");
  });

  it("requires IR_MANAGER for INTERNAL_APPROVED", () => {
    expect(minimumApprovalFor("INTERNAL_APPROVED")).toBe("IR_MANAGER");
  });

  it("requires HEAD_OF_IR for DRAFT_INTERNAL", () => {
    expect(minimumApprovalFor("DRAFT_INTERNAL")).toBe("HEAD_OF_IR");
  });
});
