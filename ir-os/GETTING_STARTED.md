# Getting Started with IR-OS

This guide walks you through launching IR-OS with a real company from zero to first agent query in about 15 minutes.

---

## Prerequisites

- Node.js 20+ (`node --version`)
- An Anthropic API key ([get one here](https://console.anthropic.com))
- Your IR documents (PDFs, Word, Excel) — or an IR website URL

---

## Step 1 — Install dependencies

```bash
cd ir-os
npm install
```

---

## Step 2 — Configure your environment

```bash
cp .env.example .env
```

Open `.env` and fill in at minimum:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
JWT_SECRET=any-long-random-string-here
DATABASE_URL=./data/ir-os.db
AUDIT_LOG_PATH=./data/audit/audit.jsonl
```

---

## Step 3 — First-time setup (interactive)

```bash
npm run setup
```

This will ask you for:
- Company name, ticker, exchange (B3 / NYSE / NASDAQ / dual-listed)
- Reporting currency (BRL / USD)
- IR website URL (optional — you can add it later)
- Your name, email, and password
- Your role (Head of IR / CFO / IR Manager)

At the end it prints your **Company ID** — save it, you'll use it in every command.

```
Company ID: co-vale3-a1b2c3d4
```

---

## Step 4 — Load your knowledge base

You have three options. All three can coexist and feed the same database.

### Option A — Upload documents you already have

Drop your files into a folder (e.g. `./my-docs`) — press releases, annual reports, presentations, models, anything — then run:

```bash
npm run ingest:file -- --folder ./my-docs --company co-vale3-a1b2c3d4
```

For subfolders:

```bash
npm run ingest:file -- --folder ./my-docs --company co-vale3-a1b2c3d4 --recursive
```

For internal documents (analyst models, internal presentations — not public):

```bash
npm run ingest:file -- --folder ./internal-models \
  --company co-vale3-a1b2c3d4 --classification INTERNAL_APPROVED
```

**Supported formats**: `.pdf` `.docx` `.doc` `.xlsx` `.xls` `.txt` `.md`

The system automatically detects:
- Document type (press release, annual report, presentation, Fato Relevante, etc.)
- Fiscal period (4Q25, FY2025, etc.) from the filename and content
- Language (Portuguese / English)

### Option B — Crawl the IR website

Point the crawler at the IR website and it will discover and download all documents:

```bash
npm run ingest:web -- \
  --url https://ri.yourcompany.com.br \
  --company co-vale3-a1b2c3d4
```

If you want to make sure specific sections are covered (press releases, filings, presentations):

```bash
npm run ingest:web -- \
  --url https://ri.yourcompany.com.br \
  --company co-vale3-a1b2c3d4 \
  --sections "https://ri.yourcompany.com.br/resultados,https://ri.yourcompany.com.br/comunicados,https://ri.yourcompany.com.br/apresentacoes" \
  --max 300
```

The crawler:
- Respects robots.txt
- Skips documents already in the database (idempotent — safe to re-run)
- Downloads PDFs and Office documents
- Extracts and indexes the text
- Detects document type, period, and language automatically

### Option C — Both (recommended)

Run both. The web crawl picks up publicly available documents. The file upload adds your internal documents and anything not on the website (financial models, analyst briefings, internal decks).

```bash
# First: crawl public IR website
npm run ingest:web -- --url https://ri.yourcompany.com.br --company co-vale3-a1b2c3d4

# Then: add internal documents
npm run ingest:file -- --folder ./internal-docs \
  --company co-vale3-a1b2c3d4 --classification INTERNAL_APPROVED
```

---

## Step 5 — Verify what's in the knowledge base

```bash
npm run ingest:status -- --company co-vale3-a1b2c3d4
```

Output example:

```
📚 Knowledge Base — Company: co-vale3-a1b2c3d4

  Total documents: 87

  By source:
    WEB_CRAWL            64
    UPLOAD               23

  By document type:
    PRESS_RELEASE                  28
    ANNUAL_REPORT                   8
    QUARTERLY_REPORT               18
    PRESENTATION                   14
    FATO_RELEVANTE                 12
    FINANCIAL_MODEL                 4
    OTHER                           3
```

Test that search is working:

```bash
npm run ingest:status -- --company co-vale3-a1b2c3d4 --search "EBITDA margem 2025"
npm run ingest:status -- --company co-vale3-a1b2c3d4 --search "resultado quarto trimestre"
npm run ingest:status -- --company co-vale3-a1b2c3d4 --type PRESS_RELEASE
```

---

## Step 6 — Start the API server

```bash
npm run dev
```

The server starts on `http://localhost:3000`. Verify it's running:

```bash
curl http://localhost:3000/health
# {"status":"ok","version":"0.1.0","timestamp":"..."}
```

---

## Step 7 — Get a JWT token (dev mode)

For development, generate a token manually. In production you'd build a proper auth flow.

Create `scripts/dev-token.ts`:

```typescript
import jwt from "jsonwebtoken";
import "dotenv/config";

const token = jwt.sign(
  { userId: "user-dev-001", role: "HEAD_OF_IR", email: "ir@company.com" },
  process.env.JWT_SECRET!,
  { expiresIn: "24h" }
);
console.log(token);
```

Run: `npx tsx scripts/dev-token.ts` — copy the token.

---

## Step 8 — Run your first agent queries

### Start an earnings cycle

```bash
curl -X POST http://localhost:3000/api/v1/workflows/earnings \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "period": { "year": 2025, "quarter": 4, "label": "4Q25" },
    "earningsDate": "2026-02-18T22:00:00Z"
  }'
```

### Invoke the Knowledge Librarian to search your documents

```bash
curl -X POST http://localhost:3000/api/v1/agents/knowledge-librarian/invoke \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "action": "SEARCH_PRECEDENTS",
      "query": "EBITDA margem crescimento receita"
    },
    "context": {
      "ticker": "TICK3",
      "exchange": "B3",
      "reportingCurrency": "BRL",
      "currentPeriod": { "year": 2025, "quarter": 4, "label": "4Q25" },
      "operatingMode": "INTERNAL_ADVISORY"
    }
  }'
```

### Prepare for an investor meeting

```bash
curl -X POST http://localhost:3000/api/v1/workflows/meeting-prep \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "meetingId": "mtg-2026-04-20-blackrock",
    "investorIds": ["inv-blackrock-001"],
    "meetingDate": "2026-04-20T14:00:00Z"
  }'
```

### Trigger a material fact emergency workflow

```bash
curl -X POST http://localhost:3000/api/v1/workflows/material-fact \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "eventDescription": "The Board approved a share buyback program of up to 5% of float.",
    "eventType": "SHARE_BUYBACK_PROGRAM",
    "deadline": "2026-04-15T18:00:00Z"
  }'
```

---

## Step 9 — Upload documents via the API

You can also ingest documents through the API (useful for a future web UI):

```bash
curl -X POST http://localhost:3000/api/v1/ingest/upload \
  -H "Authorization: Bearer <your-token>" \
  -F "files=@./4Q25-press-release.pdf" \
  -F "files=@./4Q25-presentation.pdf" \
  -F "companyId=co-vale3-a1b2c3d4" \
  -F "periodLabel=4Q25"
```

---

## Step 10 — Crawl via the API

```bash
curl -X POST http://localhost:3000/api/v1/ingest/web \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "co-vale3-a1b2c3d4",
    "baseUrl": "https://ri.yourcompany.com.br",
    "maxDocuments": 200
  }'
```

---

## Supported IR Website Patterns

The crawler works with standard Brazilian IR website layouts including:

| Platform | Pattern |
|---|---|
| RI.com.br / custom | Standard HTML with PDF links |
| MZ Group | `/resultados`, `/comunicados`, `/apresentacoes` |
| Espresso | `/release`, `/download`, `/documentos` |
| Netshow | Video + document sections |
| Direct CVM ENET links | `.pdf` files from `cvmweb.cvm.gov.br` |
| B3 document links | Direct PDF links from `b3.com.br` |

If the crawler misses content from a specific section, pass those URLs explicitly with `--sections`.

---

## What gets indexed

| Source | Examples |
|---|---|
| Press releases | Quarterly results, dividends, buybacks, management changes |
| Annual reports | DFP, 20-F, Formulário de Referência |
| Quarterly reports | ITR, 6-K |
| Fatos Relevantes | All material fact disclosures |
| Presentations | Investor Day, earnings presentations, NDR decks |
| Transcripts | If you upload earnings call transcripts as text/PDF |
| Financial models | Excel models (text extracted from cells) |
| Internal docs | Analyst briefings, approved messaging, Q&A libraries |

---

## Folder structure for your documents

A sensible way to organize files before bulk ingestion:

```
my-ir-documents/
├── press-releases/          → PRESS_RELEASE (auto-detected)
│   ├── 4Q25-results.pdf
│   ├── 3Q25-results.pdf
│   └── ...
├── annual-reports/          → ANNUAL_REPORT
│   ├── DFP-2025.pdf
│   └── ...
├── fatos-relevantes/        → FATO_RELEVANTE
│   └── ...
├── presentations/           → PRESENTATION
│   └── ...
├── internal/                → use --classification INTERNAL_APPROVED
│   ├── approved-messaging.pdf
│   ├── qa-library.xlsx
│   └── financial-model-2025.xlsx
```

Run public docs first, then internal with a separate `--classification INTERNAL_APPROVED` pass.
