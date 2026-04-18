import { Router } from "express";
import type { Request, Response } from "express";
import { createHash } from "crypto";
import jwt from "jsonwebtoken";
import { getDb } from "../../data/repositories/db";
import { CompanyRepository } from "../../data/repositories/company-repository";
import type { UserRole } from "../../types";

export const authRouter = Router();
const companyRepo = new CompanyRepository();

function hashPassword(pw: string): string {
  return createHash("sha256").update(pw + "ir-os-salt").digest("hex");
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
authRouter.post("/login", (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required." });
    return;
  }

  const user = getDb()
    .prepare("SELECT * FROM users WHERE email = ? AND is_active = 1")
    .get(email) as {
      user_id: string;
      name: string;
      email: string;
      password_hash: string;
      role: UserRole;
      company_id: string | null;
    } | undefined;

  if (!user || user.password_hash !== hashPassword(password)) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: "JWT_SECRET not configured." });
    return;
  }

  // Resolve the user's accessible companies
  const companies = companyRepo.listForUser(user.user_id);
  const defaultCompanyId = user.company_id ?? companies[0]?.company_id ?? null;

  const token = jwt.sign(
    {
      userId: user.user_id,
      role: user.role,
      email: user.email,
      companyId: defaultCompanyId,
    },
    secret,
    { expiresIn: "24h" }
  );

  res.json({
    token,
    user: {
      userId: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      defaultCompanyId,
      companies: companies.map((c) => ({ company_id: c.company_id, name: c.name, ticker: c.ticker })),
    },
  });
});

// ── SWITCH ACTIVE COMPANY (issue a new token scoped to a different company) ──
authRouter.post("/switch-company", (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const { companyId } = req.body as { companyId: string };
  if (!companyId) {
    res.status(400).json({ error: "companyId is required." });
    return;
  }

  if (!companyRepo.hasAccess(req.user.userId, companyId)) {
    res.status(403).json({ error: "You do not have access to this company." });
    return;
  }

  const company = companyRepo.findById(companyId);
  if (!company) {
    res.status(404).json({ error: `Company '${companyId}' not found.` });
    return;
  }

  const secret = process.env.JWT_SECRET!;
  const token = jwt.sign(
    {
      userId: req.user.userId,
      role: req.user.role,
      email: req.user.email,
      companyId,
    },
    secret,
    { expiresIn: "24h" }
  );

  res.json({
    token,
    activeCompany: { company_id: company.company_id, name: company.name, ticker: company.ticker },
  });
});
