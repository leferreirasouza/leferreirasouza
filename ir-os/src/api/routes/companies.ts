import { Router } from "express";
import type { Request, Response } from "express";
import { CompanyRepository } from "../../data/repositories/company-repository";
import { requireRole } from "../middleware/auth";

export const companiesRouter = Router();
const repo = new CompanyRepository();

// ── LIST companies accessible to the authenticated user ─────────────────────
companiesRouter.get("/", (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const companies = repo.listForUser(userId);
  res.json({ companies });
});

// ── LIST ALL companies (HEAD_OF_IR / CFO only — admin view) ─────────────────
companiesRouter.get("/all", requireRole(["HEAD_OF_IR", "CFO"]), (_req: Request, res: Response) => {
  res.json({ companies: repo.list() });
});

// ── GET a single company ─────────────────────────────────────────────────────
companiesRouter.get("/:companyId", (req: Request, res: Response) => {
  const { companyId } = req.params as { companyId: string };

  if (!repo.hasAccess(req.user!.userId, companyId)) {
    res.status(403).json({ error: "Access denied to this company." });
    return;
  }

  const company = repo.findById(companyId);
  if (!company) {
    res.status(404).json({ error: `Company '${companyId}' not found.` });
    return;
  }

  res.json({ company });
});

// ── CREATE a new company (HEAD_OF_IR or CFO only) ────────────────────────────
companiesRouter.post(
  "/",
  requireRole(["HEAD_OF_IR", "CFO"]),
  (req: Request, res: Response) => {
    const { name, ticker, exchange, currency, fiscal_year_end, ir_website, cvm_code, sec_cik, sector, description } =
      req.body as {
        name: string;
        ticker: string;
        exchange: string;
        currency: string;
        fiscal_year_end?: string;
        ir_website?: string;
        cvm_code?: string;
        sec_cik?: string;
        sector?: string;
        description?: string;
      };

    if (!name || !ticker || !exchange || !currency) {
      res.status(400).json({ error: "name, ticker, exchange, and currency are required." });
      return;
    }

    const existing = repo.findByTicker(ticker);
    if (existing) {
      res.status(409).json({
        error: `A company with ticker '${ticker}' already exists.`,
        company_id: existing.company_id,
      });
      return;
    }

    const company_id = repo.create({
      name,
      ticker: ticker.toUpperCase(),
      exchange,
      currency,
      fiscal_year_end: fiscal_year_end ?? "12-31",
      ir_website,
      cvm_code,
      sec_cik,
      sector,
      description,
    });

    // Automatically grant the creator access to the new company
    repo.grantAccess(req.user!.userId, company_id, "OWNER");

    const company = repo.findById(company_id);
    res.status(201).json({ company });
  }
);

// ── UPDATE a company profile ─────────────────────────────────────────────────
companiesRouter.put(
  "/:companyId",
  requireRole(["HEAD_OF_IR", "CFO"]),
  (req: Request, res: Response) => {
    const { companyId } = req.params as { companyId: string };

    if (!repo.hasAccess(req.user!.userId, companyId)) {
      res.status(403).json({ error: "Access denied to this company." });
      return;
    }

    const updated = repo.update(companyId, req.body as Parameters<typeof repo.update>[1]);
    if (!updated) {
      res.status(404).json({ error: `Company '${companyId}' not found.` });
      return;
    }

    res.json({ company: repo.findById(companyId) });
  }
);

// ── GRANT another user access to a company ───────────────────────────────────
companiesRouter.post(
  "/:companyId/users",
  requireRole(["HEAD_OF_IR", "CFO"]),
  (req: Request, res: Response) => {
    const { companyId } = req.params as { companyId: string };
    const { userId, role } = req.body as { userId: string; role?: string };

    if (!userId) {
      res.status(400).json({ error: "userId is required." });
      return;
    }

    if (!repo.findById(companyId)) {
      res.status(404).json({ error: `Company '${companyId}' not found.` });
      return;
    }

    repo.grantAccess(userId, companyId, role ?? "MEMBER");
    res.json({ message: `User ${userId} granted access to company ${companyId}.` });
  }
);
