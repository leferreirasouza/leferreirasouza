# IR-OS: Permissions and Approval Matrix

## User Role Definitions

| Role | Description | Typical Person |
|---|---|---|
| `IR_MANAGER` | Day-to-day IR operations, CRM, meeting prep | IR Analyst / IR Manager |
| `HEAD_OF_IR` | Owns the IR function, approves internal content | Head / Director of IR |
| `CFO` | Final authority on financial disclosures | Chief Financial Officer |
| `CEO` | Required for guidance, M&A, and board-level communications | Chief Executive Officer |
| `LEGAL_COUNSEL` | Reviews all filings and external communications | General Counsel / IR Legal |
| `COMMUNICATIONS` | Manages media and press release language | Head of Communications |
| `FINANCE_ANALYST` | Provides financial data; read-only on IR outputs | FP&A / Finance Team |
| `COMPLIANCE_OFFICER` | Oversees compliance framework; audit access | Compliance / Internal Control |
| `BOARD_MEMBER` | Board-level approvals (M&A, strategic disclosures) | Board Director |
| `SYSTEM` | Automated scheduled tasks; no human actions | IR-OS Scheduler |

---

## API Endpoint Access Control

| Endpoint | Allowed Roles |
|---|---|
| `POST /api/v1/workflows/earnings` | HEAD_OF_IR, CFO |
| `POST /api/v1/workflows/material-fact` | HEAD_OF_IR, CFO, CEO, LEGAL_COUNSEL |
| `POST /api/v1/workflows/meeting-prep` | IR_MANAGER, HEAD_OF_IR, CFO |
| `GET /api/v1/workflows` | All authenticated users |
| `GET /api/v1/workflows/:id` | All authenticated users |
| `POST /api/v1/workflows/:id/steps/:stepId/complete` | All authenticated users (step-specific) |
| `POST /api/v1/approvals/request` | IR_MANAGER, HEAD_OF_IR, CFO |
| `POST /api/v1/approvals/:id/decide` | IR_MANAGER, HEAD_OF_IR, CFO, CEO, LEGAL_COUNSEL, COMPLIANCE_OFFICER |
| `POST /api/v1/approvals/publish-check` | HEAD_OF_IR, CFO, CEO |
| `POST /api/v1/agents/:agentId/invoke` | All authenticated users |
| `GET /api/v1/audit` | CFO, CEO, LEGAL_COUNSEL, COMPLIANCE_OFFICER, BOARD_MEMBER |
| `GET /api/v1/audit/verify/:workflowId` | CFO, CEO, LEGAL_COUNSEL, COMPLIANCE_OFFICER, BOARD_MEMBER |

---

## Agent Tool Permissions

| Tool | Agents With Access |
|---|---|
| `search_filing_library` | All agents |
| `search_approved_messaging` | chief-of-staff, disclosure-drafting, meeting-prep, ir-website, shareholder-agm, knowledge-librarian, special-situations |
| `read_financial_data` | earnings-cycle, disclosure-drafting, consensus-sellside, capital-allocation, market-intelligence |
| `read_consensus_data` | earnings-cycle, consensus-sellside, capital-allocation |
| `read_peer_data` | market-intelligence, capital-allocation |
| `read_crm` | meeting-prep, investor-targeting, perception |
| `write_crm_note` | meeting-prep, investor-targeting |
| `read_market_data` | market-intelligence |
| `read_audit_log` | chief-of-staff, disclosure-gatekeeper, knowledge-librarian |
| `create_draft` | earnings-cycle, disclosure-drafting, consensus-sellside, meeting-prep, market-intelligence, investor-targeting, perception, capital-allocation, ir-website, shareholder-agm, knowledge-librarian |
| `update_draft` | earnings-cycle, disclosure-drafting, ir-website |
| `submit_for_approval` | earnings-cycle, disclosure-drafting, ir-website, shareholder-agm |
| `read_website_content` | ir-website |
| `read_qa_library` | earnings-cycle, disclosure-drafting, disclosure-gatekeeper, meeting-prep, knowledge-librarian |
| `read_disclosure_calendar` | chief-of-staff, earnings-cycle, special-situations, shareholder-agm |
| `update_disclosure_calendar` | earnings-cycle |
| `run_compliance_check` | disclosure-gatekeeper, special-situations |
| `trigger_escalation` | chief-of-staff, disclosure-gatekeeper, earnings-cycle, special-situations |
| `send_internal_notification` | chief-of-staff, earnings-cycle, special-situations |
| `search_knowledge_base` | All agents |

---

## Restricted Actions (No Agent May Perform)

| Action | Enforced By |
|---|---|
| `PUBLISH_EXTERNAL` | ComplianceEngine.isPublishingBlocked() |
| `FILE_WITH_REGULATOR` | ApprovalGate — human-only step in all filing workflows |
| `APPROVE_OWN_OUTPUT` | ApprovalGate — approver must be different from submitter |
| `BYPASS_COMPLIANCE_GATE` | BaseAgent.run() — gatekeeper is always in path |
| `ACCESS_PROHIBITED_DATA` | ComplianceEngine.checkInput() — PROHIBITED classification blocked |
| `MODIFY_AUDIT_LOG` | AuditLogger — append-only, no update/delete methods |
| `SEND_INVESTOR_EMAIL` | Not implemented in agent tooling — human-only action |
| `POST_TO_WEBSITE` | IRWebsiteAgent — blockedFromPublishing always true without human approval |
| `RELEASE_GUIDANCE` | EarningsCycleAgent — requires explicit guidanceApproved flag + CFO approval record |

---

## Approval Level Hierarchy

```
BOARD (5)
  └─ LEGAL_PLUS_CFO (4) ← M&A, crisis, MNPI events
       └─ CEO_AND_CFO (4) ← Guidance, strategic announcements
            └─ CFO (3) ← Earnings releases, Fatos Relevantes
                 └─ HEAD_OF_IR (2) ← Internal messaging, website content
                      └─ IR_MANAGER (1) ← Meeting briefs, CRM notes
                           └─ NONE (0) ← Fully internal/advisory outputs
```

An approver at level N can approve items requiring level N or below.
An approver cannot approve their own submitted artifacts.
