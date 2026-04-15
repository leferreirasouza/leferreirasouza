import type { Request, Response, NextFunction } from "express";
import { AuditLogger } from "../../audit/logger";

/**
 * Logs every API request to the immutable audit log.
 * Excludes health checks and GET /audit (to avoid log recursion).
 */
export function auditLogMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.path === "/health" || req.path.startsWith("/api/v1/audit")) {
    next();
    return;
  }

  const start = Date.now();
  const traceId = `trace-api-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  res.on("finish", () => {
    const audit = AuditLogger.getInstance();
    audit.log({
      eventType: "AGENT_CALLED",   // generic API call event
      userId: req.user?.userId,
      action: `${req.method} ${req.path} → ${res.statusCode}`,
      after: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
      },
      traceId,
      ipAddress: req.ip,
      sessionId: req.user?.userId,
    }).catch(console.error);
  });

  next();
}
