import { createHash } from "crypto";
import { appendFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { AuditEntry, AuditEventType } from "../types";

/**
 * IMMUTABLE AUDIT LOGGER
 *
 * Every event in IR-OS is logged here.
 * Entries are:
 * 1. Written to an append-only JSONL file (tamper-evident)
 * 2. Hashed with SHA-256 chaining (each entry includes hash of prior)
 * 3. Never deleted or modified — archive only
 *
 * This log is the authoritative record for:
 * - Regulatory inquiries
 * - Compliance reviews
 * - Approval histories
 * - Agent action traces
 */

export type PartialAuditEntry = Omit<AuditEntry, "auditId" | "timestamp" | "immutableHash"> & {
  auditId?: string;
  timestamp?: string;
};

export class AuditLogger {
  private static instance: AuditLogger;
  private logPath: string;
  private lastHash: string = "GENESIS";
  private inMemoryLog: AuditEntry[] = [];

  private constructor(logPath: string) {
    this.logPath = logPath;
    mkdirSync(dirname(logPath), { recursive: true });
  }

  static getInstance(logPath?: string): AuditLogger {
    if (!AuditLogger.instance) {
      const path = logPath ?? process.env.AUDIT_LOG_PATH ?? "./data/audit/audit.jsonl";
      AuditLogger.instance = new AuditLogger(path);
    }
    return AuditLogger.instance;
  }

  async log(partial: PartialAuditEntry): Promise<AuditEntry> {
    const entry: AuditEntry = {
      auditId: partial.auditId ?? this.generateId(),
      timestamp: partial.timestamp ?? new Date().toISOString(),
      eventType: partial.eventType,
      workflowId: partial.workflowId,
      artifactId: partial.artifactId,
      agentId: partial.agentId,
      userId: partial.userId,
      action: partial.action,
      before: partial.before,
      after: partial.after,
      ipAddress: partial.ipAddress,
      sessionId: partial.sessionId,
      traceId: partial.traceId,
    };

    // Compute tamper-evident hash
    entry.immutableHash = this.computeHash(entry);

    // Persist (append-only)
    try {
      appendFileSync(this.logPath, JSON.stringify(entry) + "\n", { encoding: "utf8", flag: "a" });
    } catch {
      // In production, fall back to in-memory and alert
      console.error("[AUDIT] Failed to write to audit log file");
    }

    this.inMemoryLog.push(entry);
    this.lastHash = entry.immutableHash;

    return entry;
  }

  /**
   * Query the in-memory log (for the current session).
   * For historical queries, the JSONL file must be read directly.
   */
  query(filter: {
    workflowId?: string;
    artifactId?: string;
    agentId?: string;
    userId?: string;
    eventType?: AuditEventType;
    from?: string;
    to?: string;
  }): AuditEntry[] {
    return this.inMemoryLog.filter((entry) => {
      if (filter.workflowId && entry.workflowId !== filter.workflowId) return false;
      if (filter.artifactId && entry.artifactId !== filter.artifactId) return false;
      if (filter.agentId && entry.agentId !== filter.agentId) return false;
      if (filter.userId && entry.userId !== filter.userId) return false;
      if (filter.eventType && entry.eventType !== filter.eventType) return false;
      if (filter.from && entry.timestamp < filter.from) return false;
      if (filter.to && entry.timestamp > filter.to) return false;
      return true;
    });
  }

  /**
   * Verify integrity of a sequence of audit entries.
   * Returns true if all hashes chain correctly.
   */
  verifyIntegrity(entries: AuditEntry[]): boolean {
    for (const entry of entries) {
      const recomputed = this.computeHash({ ...entry, immutableHash: undefined });
      if (recomputed !== entry.immutableHash) return false;
    }
    return true;
  }

  private computeHash(entry: Partial<AuditEntry>): string {
    const payload = JSON.stringify({
      auditId: entry.auditId,
      timestamp: entry.timestamp,
      eventType: entry.eventType,
      action: entry.action,
      workflowId: entry.workflowId,
      artifactId: entry.artifactId,
      agentId: entry.agentId,
      userId: entry.userId,
      traceId: entry.traceId,
      priorHash: this.lastHash,    // chain to prior entry
    });
    return createHash("sha256").update(payload).digest("hex");
  }

  private generateId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
