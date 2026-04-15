# Prompt Template: Earnings Call Script

## Structure

The earnings call script has five sections. Each section is drafted by the
Disclosure Drafting Agent. All are DRAFT_INTERNAL until CFO + CEO approval.

---

## Section 1: Operator Introduction
```
Good morning/afternoon, ladies and gentlemen. Welcome to {{COMPANY_NAME}}'s
{{PERIOD_LABEL}} earnings conference call.

This call is being recorded and will be available for replay on the Company's
investor relations website at {{IR_WEBSITE}}.

Certain statements on this call may be forward-looking within the meaning of
applicable securities laws. These statements involve risks and uncertainties,
and actual results may differ materially. Please refer to our filings with the
{{CVM / SEC}} for a discussion of these risks.

I will now turn the call over to {{IR_OFFICER_NAME}}, Head of Investor Relations.
{{IR_OFFICER_NAME}}, please go ahead.
```

---

## Section 2: IR Opening
```
Thank you, Operator. Good morning/afternoon, everyone.

Joining me today are {{CEO_NAME}}, our Chief Executive Officer, and
{{CFO_NAME}}, our Chief Financial Officer.

Before we start, I would like to remind you that this call contains
forward-looking statements. We ask that you please review the safe-harbor
language included in today's earnings release and our regulatory filings.

I will now hand the call over to {{CEO_NAME}}. {{CEO_FIRST_NAME}}, please go ahead.
```

---

## Section 3: CEO Prepared Remarks (~8–12 minutes)

Structure:
1. Opening: Quarter in context — one or two sentences on the operating environment.
2. Operational highlights: 3–4 key achievements this quarter.
3. Strategic progress: Update on named strategic priorities (draw from approved messaging).
4. Outlook narrative: Qualitative only, unless guidance is approved. No numbers unless approved.
5. Handover to CFO.

```
Thank you, {{IR_OFFICER_NAME}}.

Good morning/afternoon, everyone. {{BRIEF_ENVIRONMENT_STATEMENT}}.

During {{PERIOD_LABEL}}, we delivered {{HEADLINE_ACHIEVEMENT}}, which reflects
{{STRATEGIC_DRIVER}}.  [SOURCE: {{FILING_OR_MESSAGE_ID}}]

[OPERATIONAL HIGHLIGHT 1]
[OPERATIONAL HIGHLIGHT 2]
[OPERATIONAL HIGHLIGHT 3]

[STRATEGIC PROGRESS UPDATE — DRAW FROM APPROVED MESSAGING ONLY]

[OUTLOOK PARAGRAPH — QUALITATIVE, NO GUIDANCE UNLESS APPROVED]
{{IF GUIDANCE_APPROVED: "Regarding our outlook, we are {{GUIDANCE_LANGUAGE}}."}}
{{IF NOT GUIDANCE_APPROVED: "We look forward to providing further updates on our 
outlook in due course."}}

I will now ask {{CFO_FIRST_NAME}} to take you through the financial results in detail.
{{CFO_FIRST_NAME}}, please go ahead.
```

---

## Section 4: CFO Prepared Remarks (~10–15 minutes)

Structure:
1. Revenue — performance, mix, YoY
2. EBITDA — margin, drivers
3. Net Income / EPS
4. Balance sheet — leverage, liquidity
5. Capex and FCF
6. Guidance (if approved) — clearly labeled, with safe harbor
7. Handover for Q&A

```
Thank you, {{CEO_FIRST_NAME}}.

Starting with revenue: in {{PERIOD_LABEL}}, we reported net revenue of
{{CURRENCY}} {{REVENUE}}, representing growth of {{REVENUE_YOY}}% year-over-year.
[SOURCE: {{FILING_ID}}] This performance was driven by {{REVENUE_DRIVERS}}.

Moving to EBITDA: adjusted EBITDA reached {{CURRENCY}} {{EBITDA}}, with a margin of
{{EBITDA_MARGIN}}%, {{MARGIN_CHANGE}}bps {{UP/DOWN}} versus the prior year period.
[SOURCE: {{FILING_ID}}] Please refer to the non-GAAP reconciliation in today's release.

Net income attributable to shareholders was {{CURRENCY}} {{NET_INCOME}},
{{UP/DOWN}} {{NET_INCOME_YOY}}% year-over-year. [SOURCE: {{FILING_ID}}]

On the balance sheet: net debt stood at {{CURRENCY}} {{NET_DEBT}}, representing
{{NET_DEBT_EBITDA}}x LTM EBITDA, {{LEVERAGE_TREND}}.

{{IF GUIDANCE_APPROVED}}
Turning to guidance: for full-year {{GUIDANCE_YEAR}}, we are {{GUIDANCE_LANGUAGE}}.
This guidance reflects {{GUIDANCE_ASSUMPTIONS}}.
Actual results may differ materially from these projections.
{{END IF}}

I will now ask the Operator to open the line for questions.
```

---

## Section 5: Q&A Transition
```
Operator, we are ready to take questions. Please go ahead.

[After final question:]

Thank you all for your time and interest in {{COMPANY_NAME}}.
We look forward to speaking with you again soon.
A replay of this call will be available on our IR website within 24 hours.
Have a good day.
```

---

## Script Compliance Rules
- [ ] Forward-looking safe harbor cited in IR Opening
- [ ] All financial figures match the approved press release
- [ ] Non-GAAP metrics note reconciliation reference
- [ ] Guidance section completely blank unless `guidanceApproved = true`
- [ ] CEO and CFO quotes approved by respective executives before rehearsal
- [ ] `draftStatus = DRAFT` until CFO + CEO sign off
