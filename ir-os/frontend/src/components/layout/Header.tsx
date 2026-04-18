import { useAuth } from "../../contexts/AuthContext";
import { CompanySwitcher } from "../CompanySwitcher";

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
      <CompanySwitcher />

      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-white text-xs font-medium leading-none">{user?.name}</p>
          <p className="text-slate-500 text-xs mt-0.5">{user?.role?.replace(/_/g, " ")}</p>
        </div>
        <button
          onClick={logout}
          className="px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
