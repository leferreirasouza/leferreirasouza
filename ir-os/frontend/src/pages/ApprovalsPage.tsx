import { useApprovals } from "../hooks/useApprovals";
import { ApprovalCard } from "../components/ApprovalCard";

export default function ApprovalsPage() {
  const { pending, loading, refresh } = useApprovals(10000);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Approvals</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {pending.length} pending decision{pending.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={refresh} className="btn-secondary text-xs">Refresh</button>
      </div>

      {loading && (
        <div className="text-center py-16 text-slate-400">Loading approvals…</div>
      )}

      {!loading && pending.length === 0 && (
        <div className="card p-12 text-center">
          <span className="text-4xl">✅</span>
          <p className="mt-3 text-slate-500 text-sm">No pending approvals — you're all caught up.</p>
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-4">
          {pending.map((apr) => (
            <ApprovalCard
              key={apr.approvalId}
              approval={apr}
              onDecided={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
