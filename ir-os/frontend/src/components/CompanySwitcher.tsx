import { useState, useRef, useEffect } from "react";
import { useCompany } from "../contexts/CompanyContext";

export function CompanySwitcher() {
  const { activeCompany, companies, switching, switchCompany } = useCompany();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  if (!activeCompany) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={switching}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm transition-colors disabled:opacity-50"
      >
        <span className="font-semibold">{activeCompany.ticker}</span>
        <span className="text-slate-400 hidden sm:inline">— {activeCompany.name}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-72 bg-white rounded-xl border border-slate-200 shadow-lg z-50 py-1 overflow-hidden">
          <p className="px-3 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Switch Company</p>
          {companies.map((c) => (
            <button
              key={c.company_id}
              onClick={() => { switchCompany(c.company_id); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between transition-colors ${
                c.company_id === activeCompany.company_id ? "bg-blue-50 text-blue-700" : "text-slate-700"
              }`}
            >
              <span>
                <span className="font-semibold">{c.ticker}</span>
                <span className="text-slate-500 ml-1.5">{c.name}</span>
              </span>
              {c.company_id === activeCompany.company_id && (
                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
          {companies.length === 0 && (
            <p className="px-3 py-2 text-sm text-slate-400">No companies registered</p>
          )}
        </div>
      )}
    </div>
  );
}
