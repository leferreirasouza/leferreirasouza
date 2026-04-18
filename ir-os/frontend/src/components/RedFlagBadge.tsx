import type { RedFlag } from "../api/types";

const SEVERITY_STYLES: Record<string, string> = {
  INFO: "bg-blue-50 border-blue-200 text-blue-800",
  WARNING: "bg-yellow-50 border-yellow-200 text-yellow-800",
  CRITICAL: "bg-orange-50 border-orange-200 text-orange-800",
  BLOCK: "bg-red-50 border-red-200 text-red-800",
};

const SEVERITY_ICONS: Record<string, string> = {
  INFO: "ℹ",
  WARNING: "⚠",
  CRITICAL: "🚨",
  BLOCK: "🛑",
};

export function RedFlagBadge({ flag }: { flag: RedFlag }) {
  const style = SEVERITY_STYLES[flag.severity] ?? SEVERITY_STYLES.INFO;
  return (
    <div className={`flex gap-2 p-2 rounded-lg border text-xs ${style}`}>
      <span className="shrink-0">{SEVERITY_ICONS[flag.severity]}</span>
      <div>
        <span className="font-semibold">[{flag.code}]</span> {flag.description}
        {flag.suggestion && (
          <p className="mt-0.5 opacity-75">→ {flag.suggestion}</p>
        )}
      </div>
    </div>
  );
}

export function RedFlagList({ flags }: { flags: RedFlag[] }) {
  if (!flags.length) return null;
  return (
    <div className="space-y-1.5">
      {flags.map((f, i) => <RedFlagBadge key={i} flag={f} />)}
    </div>
  );
}
