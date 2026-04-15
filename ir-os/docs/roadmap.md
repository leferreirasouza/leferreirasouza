# IR-OS: Implementation Roadmap

## MVP (Phase 1) — Core Platform, ~8–12 weeks

**Goal**: A working multi-agent system covering the three highest-value, highest-risk workflows with full compliance controls and audit trail.

### Deliverables

| # | Component | Description |
|---|---|---|
| 1 | Type system | All TypeScript types: data-classification, agents, workflows, data-model |
| 2 | Compliance engine | Rules engine, red-flag detectors, content classifier |
| 3 | Approval gate | Full approval pipeline with role enforcement |
| 4 | Audit logger | SHA-256 chained immutable JSONL |
| 5 | Chief of Staff Agent | Orchestration and routing |
| 6 | Disclosure Gatekeeper | Full compliance review capability |
| 7 | Earnings Cycle Agent | Phase management and task tracking |
| 8 | Disclosure Drafting Agent | Press release and Fato Relevante drafts |
| 9 | Knowledge Librarian Agent | Filing retrieval and precedent search |
| 10 | Quarterly Earnings Workflow | 18-step state machine with 5 human checkpoints |
| 11 | Material Fact Workflow | 10-step emergency disclosure workflow |
| 12 | Investor Meeting Prep Workflow | 8-step briefing and feedback workflow |
| 13 | REST API | Workflows, approvals, agents, audit endpoints |
| 14 | Auth middleware | JWT + role-based access control |
| 15 | SQLite persistence | Workflows, artifacts, approvals (file-based) |
| 16 | Basic test suite | Compliance rules, red-flag detectors, approval gate |

### MVP Success Criteria
- Earnings cycle workflow runs end-to-end with 5 human checkpoints.
- Disclosure Gatekeeper blocks guidance language without approval.
- No artifact reaches APPROVED status without an authenticated human decision.
- Audit log captures every action with verified hash chain.
- All agent outputs default to DRAFT_INTERNAL.
- Publishing is impossible without APPROVED draftStatus + human action.

---

## Phase 2 — Full Agent Coverage + Data Integrations, ~8–12 weeks

**Goal**: All 14 specialist agents operational. Real data integrations. CRM and knowledge base fully functional. All 10 workflows implemented.

### Deliverables

| # | Component | Description |
|---|---|---|
| 1 | Consensus & Sell-Side Agent | Live consensus pulls, variance analysis, analyst change alerts |
| 2 | Market Intelligence Agent | Peer monitoring, sector snapshot, news scan |
| 3 | Meeting Prep Agent (full) | Full CRM integration, post-meeting feedback capture |
| 4 | Investor Targeting / CRM Agent | NDR planning, engagement scoring, ownership analysis |
| 5 | Perception Agent | Feedback synthesis, theme mapping, sentiment trends |
| 6 | Capital Allocation Agent | Peer multiples, valuation benchmarking, leverage tracking |
| 7 | IR Website Agent | Content readiness checks, draft page updates |
| 8 | Shareholder / AGM Agent | Edital drafting, proxy support, governance FAQ |
| 9 | Special Situations Agent (full) | Crisis triage, response option modeling, regulatory obligation mapping |
| 10 | Remaining workflows | Post-meeting feedback, peer monitoring, consensus tracking, website publishing, special-situation triage, AGM support, board briefing |
| 11 | PostgreSQL migration | Production-grade database with row-level security |
| 12 | Bloomberg / LSEG connector | Consensus data ingestion |
| 13 | CVM ENET filing library sync | Automated ingestion of company and peer filings |
| 14 | Vector search (pgvector) | Semantic search over filing library and knowledge base |
| 15 | Headless CMS integration | IR website content pipeline |
| 16 | Slack / email notifications | Approval request notifications and escalation alerts |
| 17 | Board briefing pack generator | Knowledge Librarian assembles structured board packs |
| 18 | Disclosure calendar automation | Recurring entry generation + alert scheduler (node-cron) |
| 19 | Full test coverage | Integration tests for all workflows, agents, and compliance rules |

---

## Phase 3 — Intelligence Layer + Dual-Listing + Advanced Features, ~12–16 weeks

**Goal**: AI-native intelligence layer on top of the operational platform. SEC/dual-listing support. Advanced perception and valuation analytics.

### Deliverables

| # | Component | Description |
|---|---|---|
| 1 | SEC dual-listing support | Form 6-K, 20-F, 8-K workflows; Reg FD enforcement in all meeting prep |
| 2 | Earnings transcript analysis | Auto-ingestion and analysis of peer earnings call transcripts |
| 3 | Advanced perception analytics | NLP-based sentiment tracking over rolling meeting history |
| 4 | Consensus anomaly detection | Alert when a specific analyst's estimate is a significant outlier |
| 5 | Investor ownership change tracking | 13F parsing (US), custodian data reconciliation |
| 6 | Automatic Fato Relevante drafting from structured event input | Fully structured intake form → draft in <60 seconds |
| 7 | ESG disclosure agent | ESG metric tracking, reporting framework alignment (GRI, SASB, TCFD) |
| 8 | Shareholder activism early-warning | Monitor 13D/13G filings and unusual ownership accumulation |
| 9 | Board briefing automation | Scheduled generation of monthly IR board packs |
| 10 | Multi-company / multi-ticker support | Platform supports IR teams covering multiple listed entities |
| 11 | Fine-tuned compliance classifier | Fine-tune a model on company-specific filings for higher accuracy |
| 12 | Role-based UI (optional) | Web interface for approval workflows, workflow status, CRM |
| 13 | API versioning + deprecation policy | v2 API with backward compatibility guarantees |
| 14 | Disaster recovery | Audit log replication, workflow state backup, RTO/RPO targets |

---

## Risks and Mitigants

| Risk | Likelihood | Impact | Mitigant |
|---|---|---|---|
| LLM hallucination in financial figures | MEDIUM | CRITICAL | Source attribution required on every claim; Gatekeeper cross-checks figures against filed documents |
| Selective disclosure via agent output | LOW | CRITICAL | Gatekeeper always in path; PROHIBITED classification blocks any non-public material information |
| Guidance disclosed without approval | MEDIUM | CRITICAL | GUIDANCE_WITHOUT_APPROVAL rule is BLOCK severity; approval flag must be explicit |
| Human approver bypassed | LOW | CRITICAL | ApprovalGate enforces role hierarchy; no agent has APPROVE_OWN_OUTPUT capability |
| Audit log tampered | LOW | HIGH | SHA-256 hash chain; append-only file; verified by `verify/:workflowId` endpoint |
| Regulatory deadline missed | MEDIUM | HIGH | Disclosure calendar with multi-day alerts; SYSTEM role sends escalation notifications |
| Inconsistency between agent output and filed documents | MEDIUM | HIGH | Compliance rule CR-008 + Gatekeeper cross-reference check (stub in MVP, full in Phase 2) |
| CVM/SEC regulatory change | LOW | MEDIUM | Compliance rules are externalized in `rules.ts` and `red-flags.ts` — updatable without agent code changes |
| API token compromise | LOW | HIGH | Short-lived JWTs (1h); rate limiting; audit log tracks all API calls with IP |
| LLM provider outage | LOW | MEDIUM | Graceful fallback: agent returns blocked response requiring manual processing; workflows pause at human checkpoints |
