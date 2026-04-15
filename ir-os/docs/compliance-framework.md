# IR-OS: Compliance Control Framework

## 1. Governing Regulatory Framework

| Regulation | Jurisdiction | Scope |
|---|---|---|
| CVM Instrução 358/2002 | Brazil | Material facts (Fatos Relevantes), insider trading restrictions |
| CVM Instrução 480/2009 | Brazil | Annual reference form (Formulário de Referência) |
| CVM Instrução 361/2002 | Brazil | Tender offers |
| CVM Instrução 369/2002 | Brazil | Exemptions from material fact disclosure |
| Lei 6.385/1976 | Brazil | Capital markets law — foundational |
| Lei 6.404/1976 | Brazil | Corporate law — disclosure obligations of officers/board |
| B3 Novo Mercado Rules | Brazil | Enhanced governance standards for listed companies |
| SEC Regulation FD | USA | Fair disclosure — no selective communication to investors |
| SEC Rule 10b-5 | USA | Anti-fraud — no misleading statements or material omissions |
| SEC Form 6-K / 20-F | USA | Foreign private issuer periodic reporting |
| IFRS IAS 34 | Global | Interim financial reporting standards |
| IFRS 8 | Global | Operating segments disclosure |

---

## 2. The Four Classification States

Every artifact, message, and data item in IR-OS carries exactly one classification. The engine enforces routing rules based on this label.

### PUBLIC
- **Definition**: Information that has been formally disclosed to all investors simultaneously through proper regulatory channels (CVM ENET, SEC EDGAR, press release, IR website).
- **Can agents produce?**: Yes — but only after human CFO approval and gatekeeper sign-off.
- **Can agents publish?**: **NO. Never. Human executes all publishing.**
- **Example**: Filed DFP, published press release, AGM edital.

### INTERNAL_APPROVED
- **Definition**: Approved for internal use across the IR team. Not for external circulation. Includes CRM data, approved messaging library, Q&A library.
- **Can agents produce?**: Yes.
- **Can agents publish?**: No.
- **Example**: Pre-earnings consensus briefing, meeting prep brief, investor targeting list.

### DRAFT_INTERNAL
- **Definition**: Working draft. Not reviewed. Never external. Requires human review before elevating to INTERNAL_APPROVED or PUBLIC.
- **Can agents produce?**: Yes — all first-pass agent outputs default to this.
- **Can agents publish?**: No.
- **Example**: First draft of press release, initial earnings script draft, triage memo.

### PROHIBITED
- **Definition**: Contains MNPI, undisclosed transaction terms, unannounced material events, or legally restricted information. Agents immediately block and escalate.
- **Can agents produce?**: No — agents block any output that reaches this classification.
- **Can agents publish?**: No — hard block.
- **Example**: Unreleased earnings figures sent to a single analyst, M&A target names, undisclosed guidance.

---

## 3. Red Flag Severity Levels

| Severity | Meaning | Action |
|---|---|---|
| **INFO** | Notable but not blocking. Log and note for reviewer. | Proceed. Flag in review notes. |
| **WARNING** | Potential issue. Reviewer must evaluate before advancing. | Proceed with caution. Flag for legal review. |
| **CRITICAL** | Must be resolved before the artifact advances to the next approval stage. | Halt step. Return to drafting agent. |
| **BLOCK** | Immediate halt. Compliance violation. | Reject output. Escalate to Legal + CFO. Audit log entry. |

---

## 4. Red Flag Code Catalogue

| Code | Trigger | Severity | Auto-Action |
|---|---|---|---|
| `SELECTIVE_DISCLOSURE_RISK` | Material info in non-public context | BLOCK | Halt + escalate Legal/CFO |
| `GUIDANCE_WITHOUT_APPROVAL` | Guidance language without CFO/CEO/Legal explicit approval | BLOCK | Halt + escalate CFO |
| `UNSUPPORTED_CLAIM` | Factual claim with no `[SOURCE: ...]` citation | WARNING | Flag for reviewer |
| `INCONSISTENCY_WITH_FILING` | Contradicts a filed document | CRITICAL | Halt + return to drafting |
| `MNPI_INDICATOR` | Potential material non-public information | BLOCK | Halt + escalate Legal |
| `PREMATURE_DISCLOSURE` | Material event not yet cleared for public release | BLOCK | Halt + escalate Legal/CFO |
| `MARKET_MANIPULATION_RISK` | Language that could be construed as market manipulation | CRITICAL | Halt + escalate Legal |
| `PROHIBITED_WORD` | "guarantee", "certain return", "risk-free" in external content | CRITICAL | Flag + require revision |
| `MISSING_SAFE_HARBOR` | Forward-looking statement without safe-harbor language | CRITICAL | Return to drafting |
| `UNVERIFIED_METRIC` | Non-GAAP KPI without GAAP reconciliation note | WARNING | Flag for reviewer |
| `REGULATORY_DEADLINE_BREACH` | Approaching or past a mandatory filing deadline | WARNING/CRITICAL | Alert + escalate IR |

---

## 5. Approval Authority Matrix

| Artifact Type | Minimum Approver | Additional Required | Notes |
|---|---|---|---|
| Meeting prep brief (internal) | IR Manager | — | Internal advisory only |
| Q&A library entry | Head of IR | — | |
| Approved messaging update | Head of IR | Legal review | |
| Consensus / peer analysis | Head of IR | — | Internal only |
| Earnings press release draft | CFO | Legal, Head of IR | |
| Fato Relevante (material fact) | CFO | Legal Counsel | Same-day filing requirement |
| Earnings guidance update | CFO + CEO | Legal Counsel | PROHIBITED until all three approve |
| Annual report (20-F / DFP) | CFO | Legal, Audit Committee | |
| M&A-related disclosure | CFO + CEO | Board approval, Legal | PROHIBITED until board resolves |
| AGM edital / proxy | CFO | Legal, Board Secretary | |
| IR website content update | Head of IR | — | No financials without CFO sign-off |
| Special situation response | CFO + Legal | CEO (if critical) | Time-critical — expedited review |

---

## 6. Selective Disclosure Controls

**Scenario**: An investor asks a question in a one-on-one meeting that touches on material non-public information.

**IR-OS Response**:
1. Meeting Prep Agent flags the topic as DO_NOT_DISCUSS before the meeting.
2. If the question is asked in the meeting, the IR team declines to answer.
3. If the IR representative accidentally discloses material information:
   - Special Situations workflow is triggered immediately.
   - Legal counsel is notified.
   - A Fato Relevante / Form 6-K must be filed to "cure" the selective disclosure per Reg FD / CVM 358.
   - The audit log captures the event with timestamp.

**Reg FD Cure Requirement** (for US holders / dual-listed):
- Intentional selective disclosure: must be simultaneous with investor communication.
- Unintentional selective disclosure: must file a broadly disseminated disclosure "promptly" (generally within 24 hours).

---

## 7. Trading Window Policy Enforcement

IR-OS checks the disclosure calendar for active trading blackout windows on every:
- Meeting prep brief generation
- Any investor-facing communication draft
- Any disclosure calendar reminder

The system surfaces a `CRITICAL` alert if:
- A draft contains financial figures during a blackout window.
- A meeting is scheduled during a blackout window with no documented exception.

---

## 8. Audit Trail Requirements

Every action in IR-OS produces an immutable audit entry. The following must be auditable:
- Who initiated each workflow and when.
- Which agent processed each step and what it produced.
- Every human approval decision (approved / rejected / returned), by whom, when, with comments.
- Every compliance check result.
- Every red flag raised and how it was resolved.
- Every publishing action.
- Every classification assignment and change.

**Retention**: Audit logs must be retained for a minimum of 5 years (aligned with CVM document retention requirements).

**Integrity**: SHA-256 hash chain on all entries. Any modification to a historical entry is detectable.
