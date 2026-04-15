/**
 * INGEST API ROUTES
 *
 * Two ingest modes — both feed the same knowledge base:
 *
 *  POST /api/v1/ingest/upload          Upload one or more files
 *  POST /api/v1/ingest/web             Crawl an IR website URL
 *  GET  /api/v1/ingest/status          Stats on what's in the knowledge base
 *  GET  /api/v1/ingest/search          Full-text search across all ingested docs
 *  GET  /api/v1/ingest/documents       List all ingested documents
 *  DELETE /api/v1/ingest/documents/:id Remove a document
 */

import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { mkdirSync } from "fs";
import { resolve } from "path";
import { requireRole } from "../middleware/auth";
import { FileIngestor } from "../../data/ingestion/file-ingestor";
import { IRWebCrawler } from "../../data/ingestion/ir-web-crawler";
import { DocumentRepository } from "../../data/repositories/document-repository";

const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR ?? "./uploads");
mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer: accept up to 20 files, 50 MB each
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },  // 50 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel", "text/plain", "text/markdown"];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|docx|doc|xlsx|xls|txt|md)$/i)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

const repo = new DocumentRepository();
const fileIngestor = new FileIngestor();
const webCrawler = new IRWebCrawler();

export const ingestRouter = Router();

// ── POST /upload ───────────────────────────────────────────────────────────

ingestRouter.post(
  "/upload",
  requireRole(["IR_MANAGER", "HEAD_OF_IR", "CFO", "COMPLIANCE_OFFICER"]),
  upload.array("files", 20),
  async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files?.length) {
      res.status(400).json({ error: "No files uploaded." });
      return;
    }

    const companyId = (req.body as { companyId?: string }).companyId;
    if (!companyId) {
      res.status(400).json({ error: "companyId is required in request body." });
      return;
    }

    const results: { file: string; docId?: string; error?: string; wordCount?: number; docType?: string }[] = [];

    for (const file of files) {
      try {
        const { docId, parsed } = await fileIngestor.ingestSingleFile(file.path, {
          companyId,
          source: "UPLOAD",
          titleOverride: (req.body as Record<string, string>)[`title_${file.fieldname}`],
          docTypeOverride: (req.body as Record<string, string>).docType,
          periodLabel: (req.body as Record<string, string>).periodLabel,
          filedAt: (req.body as Record<string, string>).filedAt,
        });
        results.push({
          file: file.originalname,
          docId,
          wordCount: parsed.wordCount,
          docType: parsed.detectedDocType,
        });
      } catch (err) {
        results.push({ file: file.originalname, error: (err as Error).message });
      }
    }

    const ingested = results.filter((r) => r.docId).length;
    res.status(201).json({ ingested, total: files.length, results });
  }
);

// ── POST /web ──────────────────────────────────────────────────────────────

ingestRouter.post(
  "/web",
  requireRole(["IR_MANAGER", "HEAD_OF_IR", "CFO"]),
  async (req: Request, res: Response) => {
    const { companyId, baseUrl, sectionUrls, maxDocuments } = req.body as {
      companyId: string;
      baseUrl: string;
      sectionUrls?: string[];
      maxDocuments?: number;
    };

    if (!companyId || !baseUrl) {
      res.status(400).json({ error: "companyId and baseUrl are required." });
      return;
    }

    // Run crawl async — return immediately with a job reference
    // In production this would be a background job; for MVP we stream progress
    const logs: string[] = [];

    try {
      const result = await webCrawler.crawl({
        companyId,
        baseUrl,
        sectionUrls: sectionUrls ?? [],
        maxDocuments: maxDocuments ?? 200,
        downloadDir: UPLOAD_DIR,
        onProgress: (msg) => logs.push(msg),
      });

      res.json({ ...result, logs });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message, logs });
    }
  }
);

// ── GET /status ────────────────────────────────────────────────────────────

ingestRouter.get("/status", requireRole(["IR_MANAGER", "HEAD_OF_IR", "CFO", "COMPLIANCE_OFFICER"]),
  (req: Request, res: Response) => {
    const companyId = req.query["companyId"] as string;
    if (!companyId) { res.status(400).json({ error: "companyId required." }); return; }
    const stats = repo.stats(companyId);
    res.json({ companyId, ...stats });
  }
);

// ── GET /search ────────────────────────────────────────────────────────────

ingestRouter.get("/search", requireRole(["IR_MANAGER", "HEAD_OF_IR", "CFO", "COMPLIANCE_OFFICER", "LEGAL_COUNSEL"]),
  (req: Request, res: Response) => {
    const { companyId, q, limit } = req.query as { companyId: string; q: string; limit?: string };
    if (!companyId || !q) { res.status(400).json({ error: "companyId and q required." }); return; }
    const results = repo.search(companyId, q, parseInt(limit ?? "10"));
    res.json({ query: q, results });
  }
);

// ── GET /documents ─────────────────────────────────────────────────────────

ingestRouter.get("/documents", requireRole(["IR_MANAGER", "HEAD_OF_IR", "CFO", "COMPLIANCE_OFFICER"]),
  (req: Request, res: Response) => {
    const { companyId, doc_type, period_year, limit } = req.query as Record<string, string>;
    if (!companyId) { res.status(400).json({ error: "companyId required." }); return; }
    const docs = repo.listByCompany(companyId, {
      doc_type,
      period_year: period_year ? parseInt(period_year) : undefined,
      limit: limit ? parseInt(limit) : 100,
    }).map((d) => ({
      doc_id: d.doc_id, title: d.title, doc_type: d.doc_type,
      source: d.source, period_label: d.period_label, filed_at: d.filed_at,
      word_count: d.word_count, language: d.language, source_url: d.source_url,
      ingested_at: d.ingested_at,
    }));
    res.json({ companyId, count: docs.length, documents: docs });
  }
);
