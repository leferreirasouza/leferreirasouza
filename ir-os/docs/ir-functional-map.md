# IR-OS: Investor Relations Functional Map

## The 12 IR Workstreams and their Owning Agents

```
IR WORKSTREAM                     PRIMARY AGENT            SUPPORTING AGENTS
─────────────────────────────────────────────────────────────────────────────
1. Mandatory Disclosure &         Disclosure Gatekeeper    Chief of Staff
   Compliance                     Disclosure Drafting      Special Situations
                                  Earnings Cycle           Knowledge Librarian

2. Earnings Cycle Management      Earnings Cycle           Disclosure Drafting
                                                           Consensus & Sell-Side
                                                           Knowledge Librarian
                                                           Meeting Prep

3. Investor & Analyst             Meeting Prep             Investor Targeting
   Engagement Support             Perception               Knowledge Librarian

4. Consensus & Sell-Side          Consensus & Sell-Side    Market Intelligence
   Monitoring                                              Knowledge Librarian

5. Market Intelligence &          Market Intelligence      Consensus & Sell-Side
   Peer Monitoring                                         Capital Allocation

6. Investor Perception            Perception               Meeting Prep
   Analysis                                                Investor Targeting

7. Capital Allocation &           Capital Allocation       Consensus & Sell-Side
   Valuation Support              Valuation                Market Intelligence

8. IR Website & Content           IR Website & Content     Disclosure Drafting
   Publishing                                              Disclosure Gatekeeper

9. Shareholder / AGM /            Shareholder / AGM        Knowledge Librarian
   Governance Communication       Support                  Disclosure Drafting
                                                           Disclosure Gatekeeper

10. Crisis, Rumor &               Special Situations       Chief of Staff
    Special Situations                                     Disclosure Gatekeeper
                                                           Disclosure Drafting

11. Internal Executive &          Chief of Staff           Knowledge Librarian
    Board Briefing Support        Knowledge Librarian      Earnings Cycle

12. Knowledge Management &        Knowledge Librarian      All agents (consumer)
    Precedent Retrieval
```

---

## Agent Mission Summary

| Agent | Mode | Primary Outputs |
|---|---|---|
| **IR Chief of Staff** | INTERNAL | Task routing, executive briefings, workflow status |
| **Disclosure Gatekeeper** | COMPLIANCE | Compliance verdicts, red flag reports, approval-level assignments |
| **Earnings Cycle** | INTERNAL → EXTERNAL (draft) | Phase plans, task trackers, readiness scores |
| **Disclosure Drafting** | EXTERNAL (draft only) | Press releases, Fatos Relevantes, earnings scripts, investor presentations |
| **Consensus & Sell-Side** | INTERNAL | Consensus tables, variance analyses, analyst change alerts |
| **Market Intelligence** | INTERNAL | Peer snapshots, sector briefs, trading alerts |
| **Meeting Prep** | INTERNAL | Meeting briefs, Q&A prep, post-meeting feedback captures |
| **Investor Targeting** | INTERNAL | Targeting lists, NDR plans, engagement scorecards |
| **Perception** | INTERNAL | Perception reports, theme maps, sentiment trends |
| **Capital Allocation** | INTERNAL | Valuation summaries, peer multiples, leverage analyses |
| **IR Website & Content** | EXTERNAL (draft only) | Page update drafts, content readiness checks |
| **Shareholder / AGM** | EXTERNAL (draft only) | Edital drafts, proxy materials, governance FAQ |
| **Special Situations** | INTERNAL → EXTERNAL (draft) | Triage assessments, response option analyses, statement outlines |
| **Knowledge Librarian** | INTERNAL | Filing retrieval, Q&A lookups, board pack assemblies |

---

## Workflow → Agent Mapping

| Workflow | Steps | Agents Involved | Human Checkpoints |
|---|---|---|---|
| Quarterly Earnings | 18 | earnings-cycle, consensus-sellside, disclosure-drafting, disclosure-gatekeeper, market-intelligence, knowledge-librarian, chief-of-staff | 5 |
| Material Fact | 10 | special-situations, disclosure-drafting, disclosure-gatekeeper, knowledge-librarian, chief-of-staff | 4 |
| Investor Meeting Prep | 8 | investor-targeting, perception, market-intelligence, meeting-prep, disclosure-gatekeeper | 2 |
| Post-Meeting Feedback | 4 | meeting-prep, perception, investor-targeting | 1 |
| Peer Monitoring | 3 | market-intelligence, consensus-sellside | 0 (automated) |
| Consensus Tracking | 3 | consensus-sellside | 0 (automated) |
| Website Publishing | 5 | ir-website, disclosure-gatekeeper | 2 |
| Special Situation Triage | 6 | special-situations, disclosure-gatekeeper, disclosure-drafting | 3 |
| AGM Support | 8 | shareholder-agm, disclosure-gatekeeper, knowledge-librarian | 3 |
| Board Briefing Pack | 4 | knowledge-librarian, chief-of-staff | 1 |

---

## Operating Modes

### INTERNAL_ADVISORY
All outputs are `DRAFT_INTERNAL` or `INTERNAL_APPROVED`. Never external. No approval required for generation (though approval is required to elevate classification). Used for: meeting briefs, perception reports, consensus analyses, peer monitoring, capital allocation analyses.

### EXTERNAL_COMMUNICATION
Outputs are drafted as `DRAFT_INTERNAL` and must pass through:
1. Disclosure Gatekeeper review
2. Legal review (for regulatory filings)
3. CFO approval (minimum for financial content)
4. CEO approval (for guidance, M&A, strategic announcements)
5. Human publishing action

Used for: press releases, Fatos Relevantes, earnings scripts, website content, AGM documents.

---

## Data Flow: Internal to External

```
Finance / Management
        │ (raw financials, narrative)
        ▼
Earnings Cycle Agent ──────────────► [DRAFT_INTERNAL artifacts]
        │
        ▼
Disclosure Drafting Agent ─────────► [DRAFT press release, script]
        │
        ▼
Disclosure Gatekeeper ─────────────► [Compliance verdict + red flags]
        │
        ├─── BLOCK ─────────────────► Escalate to Legal + CFO
        │
        └─── PASS ──────────────────► [PENDING_LEGAL_REVIEW]
                                             │
                                      Legal Counsel review
                                             │
                                      [PENDING_CFO_APPROVAL]
                                             │
                                        CFO signs off
                                             │
                                         [APPROVED]
                                             │
                                      Human executes publish
                                             │
                                         [PUBLISHED]
                                    (CVM + B3 + IR website
                                     simultaneous release)
```
