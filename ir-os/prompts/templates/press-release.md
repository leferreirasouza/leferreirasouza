# Prompt Template: Earnings Press Release

## Usage
Injected into the Disclosure Drafting Agent when `artifactType = PRESS_RELEASE`.
All `{{variables}}` are resolved from the EarningsPackage and EarningsCycleAgent output.

---

## Template (Brazilian Portuguese)

```
[EMBARGADO ATÉ {{EARNINGS_DATE}} ÀS {{EARNINGS_TIME}} (HORÁRIO DE BRASÍLIA)]

COMUNICADO AO MERCADO
{{COMPANY_NAME}} ({{EXCHANGE}}: {{TICKER}})
RESULTADOS DO {{PERIOD_LABEL}}

{{CITY}}, {{DATE}} — {{COMPANY_NAME}} ({{TICKER}}), {{BRIEF_COMPANY_DESCRIPTION}},
anuncia hoje seus resultados referentes ao {{PERIOD_LABEL}}.

DESTAQUES DO PERÍODO
• Receita Líquida: R$ {{REVENUE}} bilhões | Variação YoY: {{REVENUE_YOY}}%
• EBITDA Ajustado: R$ {{EBITDA}} bilhões | Margem EBITDA: {{EBITDA_MARGIN}}%  [SOURCE: {{FILING_ID}}]
• Lucro Líquido: R$ {{NET_INCOME}} bilhões | Variação YoY: {{NET_INCOME_YOY}}%
• Dívida Líquida / EBITDA: {{NET_DEBT_EBITDA}}x em {{PERIOD_END_DATE}}
• [GUIDANCE — INCLUIR SOMENTE SE APROVADO PELO CFO E CEO: {{GUIDANCE_TEXT}}]

RECONCILIAÇÃO DE MEDIDAS NÃO-GAAP
O EBITDA Ajustado é uma medida não-GAAP. A reconciliação com o Lucro Líquido
conforme IFRS está disponível no Anexo I deste comunicado.

COMENTÁRIO DA ADMINISTRAÇÃO
"{{CEO_QUOTE}}"
— {{CEO_NAME}}, Diretor Presidente

"{{CFO_QUOTE}}"
— {{CFO_NAME}}, Diretor Financeiro

CONFERENCE CALL DE RESULTADOS
A {{COMPANY_NAME}} realizará uma conference call para discutir os resultados do
{{PERIOD_LABEL}} em {{CALL_DATE}}, às {{CALL_TIME}} (horário de Brasília) /
{{CALL_TIME_ET}} (horário de Nova York).

Acesso: {{DIAL_IN_INFO}}
Webcast: {{WEBCAST_URL}} (disponível no site de Relações com Investidores)

DECLARAÇÕES PROSPECTIVAS
Este comunicado contém declarações prospectivas que envolvem riscos e incertezas
conhecidos e desconhecidos. Essas declarações baseiam-se em estimativas e expectativas
atuais e nos planos de negócios da Companhia. Resultados reais podem diferir
materialmente dos expressos ou implícitos nessas declarações. A {{COMPANY_NAME}}
não assume nenhuma obrigação de atualizar ou revisar publicamente quaisquer
declarações prospectivas em razão de novas informações, eventos futuros ou outros fatores.

SOBRE A {{COMPANY_NAME}}
{{COMPANY_DESCRIPTION_BOILERPLATE}}

RELAÇÕES COM INVESTIDORES
{{IR_CONTACT_NAME}}
{{IR_EMAIL}}
{{IR_PHONE}}
{{IR_WEBSITE}}
```

---

## Compliance Checklist Before Submission to Gatekeeper

- [ ] All financial figures sourced from reviewed/audited financials `[SOURCE: ...]`
- [ ] Non-GAAP metrics include reconciliation reference
- [ ] Forward-looking safe-harbor paragraph included
- [ ] Guidance section left blank unless `guidanceApproved = true`
- [ ] CEO and CFO quotes approved by respective executives
- [ ] Conference call details confirmed with IR team
- [ ] `draftStatus = DRAFT` — not final until CFO approval
