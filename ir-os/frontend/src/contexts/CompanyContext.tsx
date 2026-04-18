import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Company } from "../api/types";
import { companiesApi } from "../api/companies";
import { useAuth } from "./AuthContext";

interface CompanyContextValue {
  activeCompany: Company | null;
  companies: Company[];
  switching: boolean;
  switchCompany: (companyId: string) => Promise<void>;
  refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { token, user, updateToken } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [switching, setSwitching] = useState(false);

  const refreshCompanies = useCallback(async () => {
    if (!token) return;
    try {
      const data = await companiesApi.list();
      setCompanies(data.companies);
      if (!activeCompany && data.companies.length > 0) {
        const defaultId = user?.defaultCompanyId;
        const def = defaultId
          ? data.companies.find((c) => c.company_id === defaultId)
          : null;
        setActiveCompany(def ?? data.companies[0]);
      }
    } catch {
      // silently fail during initial load
    }
  }, [token, user?.defaultCompanyId, activeCompany]);

  useEffect(() => {
    refreshCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const switchCompany = useCallback(
    async (companyId: string) => {
      setSwitching(true);
      try {
        const res = await companiesApi.switchCompany(companyId);
        updateToken(res.token);
        const found = companies.find((c) => c.company_id === companyId);
        if (found) setActiveCompany(found);
      } finally {
        setSwitching(false);
      }
    },
    [companies, updateToken]
  );

  return (
    <CompanyContext.Provider
      value={{ activeCompany, companies, switching, switchCompany, refreshCompanies }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}
