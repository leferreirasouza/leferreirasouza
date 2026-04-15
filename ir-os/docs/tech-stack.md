# IR-OS: Recommended Technology Stack

## Runtime & Language
| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript 5.x | Type safety critical for compliance schemas; shared types across API + agents |
| Runtime | Node.js 20 LTS | Stable, async-first, broad ecosystem |
| Framework | Express 4.x | Lightweight, well-understood, easy to add middleware |
| Package manager | npm / pnpm | Standard |

## AI / LLM
| Component | Choice | Rationale |
|---|---|---|
| LLM Provider | Anthropic Claude | claude-opus-4-6 for high-stakes compliance reasoning; claude-haiku-4-5 for fast internal advisory tasks |
| SDK | `@anthropic-ai/sdk` | Official Anthropic SDK with prompt caching |
| Prompt caching | Enabled on system prompts | Reduces latency and cost for repeated agent calls |
| Tool use | Anthropic tool use API | Structured outputs from agents; validated against Zod schemas |

## Data Persistence
| Layer | MVP Choice | Production Choice |
|---|---|---|
| Primary database | SQLite (better-sqlite3) | PostgreSQL 15+ with row-level security |
| Audit log | Append-only JSONL file | Immutable S3-compatible object store + JSONL |
| File storage | Local filesystem | AWS S3 / Azure Blob (PDFs, filings, exports) |
| Vector store (knowledge base) | In-memory (MVP) | pgvector or Pinecone for semantic search over filings |
| Cache | In-memory Map | Redis for session state and workflow engine state |

## Authentication & Security
| Component | Choice |
|---|---|
| Auth | JWT (jsonwebtoken) — short-lived tokens (1h), refresh via separate endpoint |
| Role enforcement | Middleware per endpoint + BaseAgent permission checks |
| Secrets management | `.env` file (dev) → AWS Secrets Manager / HashiCorp Vault (prod) |
| API security | Helmet (HTTP headers), express-rate-limit, input validation via Zod |
| TLS | Required in production (terminate at load balancer) |

## Integrations
| System | Integration Pattern |
|---|---|
| CVM ENET (Brazil filing) | Human-executed — IR-OS produces the document, human files via CVM portal |
| B3 (Brazilian exchange) | Human-executed — simultaneous with CVM filing |
| SEC EDGAR (US, dual-listed) | Human-executed — Form 6-K / 20-F uploaded manually or via filing agent |
| Bloomberg / LSEG | Data ingestion API for consensus and market data |
| IR Website CMS | Headless CMS REST API — IR-OS submits draft content; human publishes |
| Email / Slack | Approval notifications via webhook (configurable) |
| Document parsing | pdf-parse (PDFs), mammoth (Word), xlsx (Excel) for filing ingestion |

## Testing
| Layer | Tool |
|---|---|
| Unit + integration tests | Vitest |
| Type checking | TypeScript strict mode |
| Linting | ESLint + @typescript-eslint |
| Compliance rule tests | Unit tests with known-bad and known-good fixtures |

## Monitoring & Operations (Production)
| Concern | Tool |
|---|---|
| Structured logging | Winston (JSON output) → Datadog / CloudWatch |
| Distributed tracing | traceId propagated through all agent calls |
| Alerting | PagerDuty / OpsGenie for CRITICAL red flags and workflow blockers |
| Uptime | Health endpoint `/health` → load balancer health check |
| Audit export | Scheduled job exports JSONL audit log to cold storage nightly |

## Deployment
| Environment | Stack |
|---|---|
| Development | Local Node.js + SQLite |
| Staging | Docker Compose (API + PostgreSQL + Redis) |
| Production | Kubernetes (EKS / GKE) or AWS ECS Fargate; RDS PostgreSQL; ElastiCache Redis |

## Folder Structure

```
ir-os/
├── src/
│   ├── types/                   # Shared TypeScript types
│   │   ├── data-classification.ts
│   │   ├── agents.ts
│   │   ├── workflows.ts
│   │   ├── data-model.ts
│   │   └── index.ts
│   ├── agents/                  # Specialist agents
│   │   ├── base/
│   │   │   ├── agent-interface.ts
│   │   │   └── agent-registry.ts
│   │   ├── chief-of-staff/
│   │   ├── disclosure-gatekeeper/
│   │   ├── earnings-cycle/
│   │   ├── disclosure-drafting/
│   │   ├── consensus-sellside/
│   │   ├── market-intelligence/
│   │   ├── meeting-prep/
│   │   ├── investor-targeting/
│   │   ├── perception/
│   │   ├── capital-allocation/
│   │   ├── ir-website/
│   │   ├── shareholder-agm/
│   │   ├── special-situations/
│   │   └── knowledge-librarian/
│   ├── workflows/               # Workflow state machines
│   │   ├── engine.ts
│   │   ├── quarterly-earnings.ts
│   │   ├── material-fact.ts
│   │   └── investor-meeting-prep.ts
│   ├── compliance/              # Compliance engine
│   │   ├── engine.ts
│   │   ├── rules.ts
│   │   ├── red-flags.ts
│   │   ├── classification.ts
│   │   └── approval-gate.ts
│   ├── data/
│   │   └── schemas/             # JSON Schemas for all data models
│   ├── api/                     # Express REST API
│   │   ├── index.ts
│   │   ├── routes/
│   │   └── middleware/
│   └── audit/                   # Immutable audit logger
│       └── logger.ts
├── docs/                        # Architecture, compliance, permissions, roadmap
├── examples/                    # Sample payloads and outputs
├── tests/                       # Vitest test suites
├── .env.example
├── package.json
└── tsconfig.json
```
