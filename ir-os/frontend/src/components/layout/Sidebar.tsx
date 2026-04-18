import { NavLink } from "react-router-dom";
import { useApprovals } from "../../hooks/useApprovals";

const NAV = [
  { to: "/", label: "Dashboard", icon: "⬛", exact: true },
  { to: "/agents", label: "Agents", icon: "🤖" },
  { to: "/workflows", label: "Workflows", icon: "🔄" },
  { to: "/approvals", label: "Approvals", icon: "✅" },
  { to: "/documents", label: "Documents", icon: "📄" },
  { to: "/audit", label: "Audit Log", icon: "🔍" },
];

export function Sidebar() {
  const { pending } = useApprovals(15000);

  return (
    <aside className="w-56 shrink-0 bg-slate-900 text-slate-300 flex flex-col h-full">
      <div className="px-4 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📊</span>
          <div>
            <p className="text-white font-bold text-sm leading-none">IR-OS</p>
            <p className="text-slate-500 text-xs mt-0.5">Investor Relations AI</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`
            }
          >
            <span className="text-base">{icon}</span>
            <span>{label}</span>
            {label === "Approvals" && pending.length > 0 && (
              <span className="ml-auto bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                {pending.length}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-600">
        v0.1.0
      </div>
    </aside>
  );
}
