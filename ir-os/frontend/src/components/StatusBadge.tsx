const STATUS_COLORS: Record<string, string> = {
  INITIATED: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  AWAITING_HUMAN_INPUT: "bg-yellow-100 text-yellow-700",
  AWAITING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-slate-100 text-slate-500",
  FAILED: "bg-red-100 text-red-700",
  DRAFT: "bg-slate-100 text-slate-600",
  PENDING_IR_REVIEW: "bg-yellow-100 text-yellow-700",
  PENDING_CFO_APPROVAL: "bg-amber-100 text-amber-700",
  PENDING_CEO_APPROVAL: "bg-orange-100 text-orange-700",
  PENDING_LEGAL_REVIEW: "bg-purple-100 text-purple-700",
  PENDING_BOARD_APPROVAL: "bg-red-100 text-red-700",
  PUBLISHED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  RETURNED_FOR_REVISION: "bg-orange-100 text-orange-700",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700";
  const label = status.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
