# IR-OS: AI-Native Investor Relations Operating System

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         IR-OS PLATFORM                              │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   API LAYER (Express + JWT)                   │  │
│  │  /workflows  /approvals  /agents  /audit                      │  │
│  └────────────────────────┬─────────────────────────────────────┘  │
│                           │                                         │
│  ┌────────────────────────▼─────────────────────────────────────┐  │
│  │              ORCHESTRATION LAYER                              │  │
│  │                                                               │  │
│  │   ┌─────────────────────────────────────────────────────┐    │  │
│  │   │          IR CHIEF OF STAFF AGENT                     │    │  │
│  │   │  Routes tasks · Monitors deadlines · Briefs execs   │    │  │
│  │   └──────────────────────┬──────────────────────────────┘    │  │
│  │                          │ handoffs                           │  │
│  └──────────────────────────┼───────────────────────────────────┘  │
│                             │                                       │
│  ┌──────────────────────────▼───────────────────────────────────┐  │
│  │              COMPLIANCE GATEKEEPER (always in path)          │  │
│  │   Blocks MNPI · Flags selective disclosure · Enforces        │  │
│  │   safe-harbor · Validates sources · Assigns classification   │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                             │ passes / blocks                       │
│  ┌──────────────────────────┼───────────────────────────────────┐  │
│  │           SPECIALIST AGENTS                                   │  │
│  │                                                               │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │  │
│  │  │ Earnings     │  │ Disclosure   │  │ Consensus /      │   │  │
│  │  │ Cycle        │  │ Drafting     │  │ Sell-Side        │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │  │
│  │  │ Market       │  │ Meeting Prep │  │ Investor         │   │  │
│  │  │ Intelligence │  │              │  │ Targeting / CRM  │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │  │
│  │  │ Perception   │  │ Capital      │  │ IR Website       │   │  │
│  │  │              │  │ Allocation   │  │ & Content        │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │  │
│  │  │ Shareholder  │  │ Special      │  │ Knowledge        │   │  │
│  │  │ / AGM        │  │ Situations   │  │ Librarian        │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              HUMAN APPROVAL GATE                              │  │
│  │  Required before: any external publish · regulatory filing   │  │
│  │  Roles: IR_MANAGER / HEAD_OF_IR / CFO / CEO / LEGAL         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              IMMUTABLE AUDIT LOG (SHA-256 chained JSONL)     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Classification Flow

```
Agent Output
     │
     ▼
 Classify ──────► PROHIBITED ──────► BLOCKED immediately
     │                               Escalate to Legal + CFO
     │
     ├──────────► DRAFT_INTERNAL ──► Internal advisory only
     │                               Requires HEAD_OF_IR review
     │
     ├──────────► INTERNAL_APPROVED ► Approved for internal use
     │                               Requires IR_MANAGER review
     │
     └──────────► PUBLIC ──────────► Requires CFO approval
                                     + Gatekeeper sign-off
                                     + Human publishing action
```

## Approval Pipeline

```
[DRAFT] → Gatekeeper Review → [PENDING_COMPLIANCE_REVIEW]
        → Compliance Pass   → [PENDING_LEGAL_REVIEW]
        → Legal Sign-Off    → [PENDING_CFO_APPROVAL]
        → CFO Approval      → [APPROVED]
        → Human Publishes   → [PUBLISHED]

No agent can transition to APPROVED or PUBLISHED.
Only authenticated humans with the required role can approve.
```

## Publishing Absolute Rule

```
canPublish() returns TRUE only when:
  1. artifact.draftStatus === "APPROVED"
  2. approvalRecords includes at least one APPROVED decision
  3. No BLOCK-level red flags remain
  4. A human with the correct role explicitly calls the publish action
```
