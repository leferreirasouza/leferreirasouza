# IR-OS: AI-Native Investor Relations Operating System

A production-grade, multi-agent platform for investor relations departments at Brazil-listed and dual-listed (Brazil/US) public companies. Built to automate, accelerate, and safeguard the full IR workload — from quarterly earnings cycles to emergency material-fact disclosures — while enforcing strict compliance, human approval controls, and immutable audit trails.

---

## Core Design Principles

| Principle | Implementation |
|---|---|
| **Compliance over convenience** | When usefulness conflicts with compliance, compliance wins. Always. |
| **Humans approve, agents draft** | No agent can publish, file, or approve its own output. Ever. |
| **Source-linked outputs** | Every factual claim in an agent output must carry a `[SOURCE: id]` citation. |
| **Four-state classification** | Every artifact is `PUBLIC`, `INTERNAL_APPROVED`, `DRAFT_INTERNAL`, or `PROHIBITED`. |
| **Immutable audit trail** | SHA-256 hash-chained append-only log for every action in the system. |
| **Red-flag-first** | The Disclosure Gatekeeper is always in the content path. It cannot be bypassed. |

---

## Agent Architecture

```
IR Chief of Staff Agent          — Orchestration, routing, executive briefings
Disclosure & Compliance Gatekeeper — Compliance firewall (always in path)
Earnings Cycle Agent             — Quarterly results cycle management
Disclosure Drafting Agent        — Press releases, Fatos Relevantes, scripts
Consensus & Sell-Side Agent      — Consensus tracking, analyst monitoring
Market Intelligence Agent        — Peer monitoring, sector context, news
Meeting Prep Agent               — Investor briefs, post-meeting feedback
Investor Targeting / CRM Agent   — NDR planning, CRM maintenance
Perception Agent                 — Investor feedback synthesis
Capital Allocation Agent         — Valuation benchmarking, leverage tracking
IR Website & Content Agent       — Website readiness, content staging
Shareholder / AGM Support Agent  — AGM documents, proxy, governance FAQ
Special Situations Agent         — Crisis triage, material event response
Knowledge Librarian Agent        — Filing retrieval, Q&A lookup, board packs
```

---

## Workflows

| Workflow | Steps | Human Gates |
|---|---|---|
| Quarterly Earnings | 18 | 5 |
| Material Fact (Fato Relevante) | 10 | 4 |
| Investor Meeting Prep | 8 | 2 |
| Special Situation Triage | 8 | 3 |
| IR Website Publishing | 5 | 2 |
| Board Briefing Pack | 5 | 1 |

---

## Publishing Rule (Absolute)

```
An artifact can only reach external audiences when ALL of the following are true:
  1. draftStatus === "APPROVED"
  2. At least one ApprovalRecord with decision === "APPROVED" from a human
     with the required role (minimum CFO for financial content)
  3. No BLOCK-level compliance red flags remain
  4. A human explicitly executes the publishing action

No agent can publish. No agent can approve its own output.
```

---

## Regulatory Framework

- CVM Instrução 358/2002 — Material Facts (Fatos Relevantes)
- CVM Instrução 480/2009 — Reference Form
- Lei 6.385/1976 + Lei 6.404/1976 — Capital markets and corporate law
- B3 Novo Mercado Regulations
- SEC Regulation FD — Fair Disclosure (for US holders / dual-listed)
- SEC Rule 10b-5 — Anti-fraud
- IFRS IAS 34 / IFRS 8

---

## Quick Start

```bash
# Clone and install
cd ir-os
npm install

# Configure environment
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY, JWT_SECRET, DATABASE_URL

# Run development server
npm run dev

# Run tests
npm test

# Type check
npm run typecheck
```

---

## API Surface

```
POST /api/v1/workflows/earnings          Create quarterly earnings workflow
POST /api/v1/workflows/material-fact     Create material fact workflow
POST /api/v1/workflows/meeting-prep      Create meeting prep workflow
GET  /api/v1/workflows                   List all workflows
GET  /api/v1/workflows/:id               Get workflow detail + steps
POST /api/v1/workflows/:id/steps/:stepId/complete  Provide human input

POST /api/v1/approvals/request           Submit artifact for approval
POST /api/v1/approvals/:id/decide        Grant or deny approval (human only)
POST /api/v1/approvals/publish-check     Final publishing gate validation

POST /api/v1/agents/:agentId/invoke      Invoke a specialist agent
GET  /api/v1/agents                      List registered agents

GET  /api/v1/audit                       Query audit log (Compliance/Legal/CFO only)
GET  /api/v1/audit/verify/:workflowId    Verify audit log integrity
```

---

## Project Structure

```
ir-os/
├── src/
│   ├── types/           Shared TypeScript types (classification, agents, workflows, data-model)
│   ├── agents/          14 specialist agents + base class + registry
│   ├── workflows/       State machine definitions for all IR workflows
│   ├── compliance/      Engine, rules, red-flag detectors, classifier, approval gate
│   ├── data/schemas/    JSON Schemas for all domain entities
│   ├── api/             Express REST API with auth and audit middleware
│   └── audit/           Immutable SHA-256 chained audit logger
├── docs/                Architecture, compliance framework, permissions, roadmap
├── prompts/templates/   Structured templates for press releases, Fatos Relevantes, scripts
├── examples/            Sample input payloads and agent output examples
└── tests/               Vitest test suites for compliance rules and workflows
```

---

## Documentation

- [Architecture Diagram](docs/architecture.md)
- [IR Functional Map](docs/ir-functional-map.md)
- [Compliance Framework](docs/compliance-framework.md)
- [Permissions & Approval Matrix](docs/permissions-matrix.md)
- [Technology Stack](docs/tech-stack.md)
- [Roadmap & Risks](docs/roadmap.md)

---

## License

Private — for authorized use only. Contains compliance logic for Brazil capital markets regulation. Not for public distribution.
