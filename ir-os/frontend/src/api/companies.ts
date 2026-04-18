import { api } from "./client";
import type { Company } from "./types";

export const companiesApi = {
  list: () => api.get<{ companies: Company[] }>("/companies"),

  get: (companyId: string) =>
    api.get<{ company: Company }>(`/companies/${companyId}`),

  create: (body: Partial<Company>) =>
    api.post<{ company: Company }>("/companies", body),

  update: (companyId: string, body: Partial<Company>) =>
    api.put<{ company: Company }>(`/companies/${companyId}`, body),

  switchCompany: (companyId: string) =>
    api.post<{ token: string; activeCompany: { company_id: string; name: string; ticker: string } }>(
      "/auth/switch-company",
      { companyId }
    ),
};
