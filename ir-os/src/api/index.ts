import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { workflowRouter } from "./routes/workflows";
import { approvalsRouter } from "./routes/approvals";
import { agentsRouter } from "./routes/agents";
import { auditRouter } from "./routes/audit";
import { ingestRouter } from "./routes/ingest";
import { auditLogMiddleware } from "./middleware/audit-log";
import { authMiddleware } from "./middleware/auth";

const app = express();
const PORT = process.env.API_PORT ?? 3000;

// ---- Security middleware ----
app.use(helmet());
app.use(express.json({ limit: "2mb" }));

// ---- Rate limiting ----
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    message: { error: "Rate limit exceeded." },
  })
);

// ---- Auth ----
app.use(authMiddleware);

// ---- Audit every request ----
app.use(auditLogMiddleware);

// ---- Routes ----
app.use("/api/v1/workflows", workflowRouter);
app.use("/api/v1/approvals", approvalsRouter);
app.use("/api/v1/agents", agentsRouter);
app.use("/api/v1/audit", auditRouter);
app.use("/api/v1/ingest", ingestRouter);

// ---- Health ----
app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: "0.1.0", timestamp: new Date().toISOString() });
});

// ---- Global error handler ----
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[API ERROR]", err.message);
    res.status(500).json({
      error: "Internal server error",
      // Do NOT expose stack traces in production
    });
  }
);

app.listen(PORT, () => {
  console.log(`IR-OS API running on port ${PORT}`);
});

export default app;
