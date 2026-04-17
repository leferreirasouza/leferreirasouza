/**
 * NEWS SOURCE REGISTRY
 *
 * All monitored news sources, organized by category.
 * Each source has: name, feed URL (RSS or scrape), language, category, and
 * an optional "sector relevance" field so sources can be turned on/off by sector.
 *
 * ADD NEW SOURCES HERE — the scraper picks them up automatically.
 */

export interface NewsSource {
  id: string;
  name: string;
  url: string;                          // homepage
  feedUrl?: string;                     // RSS/Atom feed URL (preferred)
  scrapeUrl?: string;                   // fallback: HTML page to scrape links from
  type: "RSS" | "SCRAPE" | "API";
  language: "PT" | "EN" | "ES";
  category: NewsCategory;
  sectors?: string[];                   // if null/empty = all sectors
  priority: "HIGH" | "MEDIUM" | "LOW";
  active: boolean;
}

export type NewsCategory =
  | "GENERAL_BUSINESS"       // broad business / economy news
  | "CAPITAL_MARKETS"        // stock market, M&A, IPO
  | "REGULATORY"             // CVM, SEC, BACEN, ANEEL, ANP, etc.
  | "COMMODITY"              // commodity prices and trends
  | "MACRO_ECONOMY"          // GDP, inflation, interest rates, FX
  | "SECTOR_SPECIFIC"        // sector trade publications
  | "COMPETITOR"             // competitor press releases (injected dynamically)
  | "COMPANY_SPECIFIC"       // direct company mentions (injected dynamically)
  | "ESG"                    // ESG/sustainability developments
  | "LEGISLATION"            // new laws, regulations, decrees
  | "CREDIT_RATINGS";        // S&P, Moody's, Fitch rating actions

export const NEWS_SOURCES: NewsSource[] = [
  // ── BRAZIL — GENERAL BUSINESS ─────────────────────────────────────────
  {
    id: "valor-economico",
    name: "Valor Econômico",
    url: "https://valor.globo.com",
    feedUrl: "https://valor.globo.com/rss/home",
    type: "RSS",
    language: "PT",
    category: "GENERAL_BUSINESS",
    priority: "HIGH",
    active: true,
  },
  {
    id: "infomoney",
    name: "InfoMoney",
    url: "https://www.infomoney.com.br",
    feedUrl: "https://www.infomoney.com.br/feed/",
    type: "RSS",
    language: "PT",
    category: "CAPITAL_MARKETS",
    priority: "HIGH",
    active: true,
  },
  {
    id: "exame",
    name: "Exame",
    url: "https://exame.com",
    feedUrl: "https://exame.com/feed/",
    type: "RSS",
    language: "PT",
    category: "GENERAL_BUSINESS",
    priority: "MEDIUM",
    active: true,
  },
  {
    id: "reuters-brasil",
    name: "Reuters Brasil",
    url: "https://www.reuters.com/world/americas/brazil/",
    feedUrl: "https://feeds.reuters.com/reuters/BRbroadestNews",
    type: "RSS",
    language: "PT",
    category: "GENERAL_BUSINESS",
    priority: "HIGH",
    active: true,
  },
  {
    id: "bloomberg-linea-br",
    name: "Bloomberg Línea Brasil",
    url: "https://bloomberglinea.com.br",
    feedUrl: "https://bloomberglinea.com.br/feed/",
    type: "RSS",
    language: "PT",
    category: "CAPITAL_MARKETS",
    priority: "HIGH",
    active: true,
  },
  {
    id: "estadao-economia",
    name: "Estadão Economia",
    url: "https://economia.estadao.com.br",
    feedUrl: "https://economia.estadao.com.br/rss/home,economia.xml",
    type: "RSS",
    language: "PT",
    category: "GENERAL_BUSINESS",
    priority: "MEDIUM",
    active: true,
  },
  {
    id: "folha-mercado",
    name: "Folha de São Paulo — Mercado",
    url: "https://www.folha.uol.com.br/mercado/",
    feedUrl: "https://feeds.folha.uol.com.br/mercado/rss091.xml",
    type: "RSS",
    language: "PT",
    category: "GENERAL_BUSINESS",
    priority: "MEDIUM",
    active: true,
  },
  {
    id: "neofeed",
    name: "NeoFeed",
    url: "https://neofeed.com.br",
    feedUrl: "https://neofeed.com.br/feed/",
    type: "RSS",
    language: "PT",
    category: "CAPITAL_MARKETS",
    priority: "MEDIUM",
    active: true,
  },

  // ── BRAZIL — REGULATORY ────────────────────────────────────────────────
  {
    id: "cvm-noticias",
    name: "CVM — Notícias",
    url: "https://www.gov.br/cvm/pt-br",
    scrapeUrl: "https://www.gov.br/cvm/pt-br/assuntos/noticias",
    type: "SCRAPE",
    language: "PT",
    category: "REGULATORY",
    priority: "HIGH",
    active: true,
  },
  {
    id: "bacen-noticias",
    name: "Banco Central do Brasil — Notas",
    url: "https://www.bcb.gov.br",
    feedUrl: "https://www.bcb.gov.br/api/feed/rss/noticias",
    type: "RSS",
    language: "PT",
    category: "REGULATORY",
    priority: "HIGH",
    active: true,
  },
  {
    id: "b3-noticias",
    name: "B3 — Comunicados",
    url: "https://www.b3.com.br",
    scrapeUrl: "https://www.b3.com.br/pt_br/noticias/",
    type: "SCRAPE",
    language: "PT",
    category: "REGULATORY",
    priority: "HIGH",
    active: true,
  },
  {
    id: "senado-legislacao",
    name: "Senado Federal — Legislação",
    url: "https://www.senado.leg.br",
    feedUrl: "https://www.senado.leg.br/noticias/rss/ultimas.xml",
    type: "RSS",
    language: "PT",
    category: "LEGISLATION",
    priority: "MEDIUM",
    active: true,
  },

  // ── GLOBAL — ENGLISH ──────────────────────────────────────────────────
  {
    id: "reuters-global",
    name: "Reuters — Business",
    url: "https://www.reuters.com/business/",
    feedUrl: "https://feeds.reuters.com/reuters/businessNews",
    type: "RSS",
    language: "EN",
    category: "GENERAL_BUSINESS",
    priority: "HIGH",
    active: true,
  },
  {
    id: "ft-emerging",
    name: "Financial Times — Emerging Markets",
    url: "https://www.ft.com/emerging-markets",
    feedUrl: "https://www.ft.com/rss/home/uk",
    type: "RSS",
    language: "EN",
    category: "CAPITAL_MARKETS",
    priority: "MEDIUM",
    active: true,
  },
  {
    id: "wsj-markets",
    name: "Wall Street Journal — Markets",
    url: "https://www.wsj.com/news/markets",
    feedUrl: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    type: "RSS",
    language: "EN",
    category: "CAPITAL_MARKETS",
    priority: "MEDIUM",
    active: true,
  },
  {
    id: "latam-advisor",
    name: "Latin America Advisor",
    url: "https://www.thedialogue.org/programs/latin-america-advisor/",
    type: "SCRAPE",
    scrapeUrl: "https://www.thedialogue.org/programs/latin-america-advisor/",
    language: "EN",
    category: "MACRO_ECONOMY",
    priority: "LOW",
    active: true,
  },

  // ── COMMODITIES (sector-specific sources) ─────────────────────────────
  {
    id: "mining-com",
    name: "Mining.com",
    url: "https://www.mining.com",
    feedUrl: "https://www.mining.com/feed/",
    type: "RSS",
    language: "EN",
    category: "COMMODITY",
    sectors: ["Mining", "Steel", "Metals"],
    priority: "HIGH",
    active: true,
  },
  {
    id: "reuters-commodities",
    name: "Reuters — Commodities",
    url: "https://www.reuters.com/markets/commodities/",
    feedUrl: "https://feeds.reuters.com/reuters/commoditiesNews",
    type: "RSS",
    language: "EN",
    category: "COMMODITY",
    priority: "HIGH",
    active: true,
  },
  {
    id: "agrimoney",
    name: "AgriMoney",
    url: "https://www.agrimoney.com",
    feedUrl: "https://www.agrimoney.com/rss/",
    type: "RSS",
    language: "EN",
    category: "COMMODITY",
    sectors: ["Agriculture", "Food & Beverage", "Agro"],
    priority: "HIGH",
    active: true,
  },
  {
    id: "oilprice",
    name: "OilPrice.com",
    url: "https://oilprice.com",
    feedUrl: "https://oilprice.com/rss/main",
    type: "RSS",
    language: "EN",
    category: "COMMODITY",
    sectors: ["Oil & Gas", "Energy", "Petrochemicals"],
    priority: "HIGH",
    active: true,
  },
  {
    id: "power-magazine",
    name: "Power Magazine",
    url: "https://www.powermag.com",
    feedUrl: "https://www.powermag.com/feed/",
    type: "RSS",
    language: "EN",
    category: "SECTOR_SPECIFIC",
    sectors: ["Utilities", "Energy", "Power Generation"],
    priority: "MEDIUM",
    active: true,
  },
  {
    id: "canalenergia",
    name: "Canal Energia",
    url: "https://www.canalenergia.com.br",
    feedUrl: "https://www.canalenergia.com.br/feed/",
    type: "RSS",
    language: "PT",
    category: "SECTOR_SPECIFIC",
    sectors: ["Utilities", "Energy"],
    priority: "HIGH",
    active: true,
  },
  {
    id: "telecom-paper",
    name: "Telecom Paper",
    url: "https://www.telecompaper.com",
    feedUrl: "https://www.telecompaper.com/rss/all/",
    type: "RSS",
    language: "EN",
    category: "SECTOR_SPECIFIC",
    sectors: ["Telecom", "Technology"],
    priority: "MEDIUM",
    active: true,
  },

  // ── ESG ───────────────────────────────────────────────────────────────
  {
    id: "esg-today",
    name: "ESG Today",
    url: "https://www.esgtoday.com",
    feedUrl: "https://www.esgtoday.com/feed/",
    type: "RSS",
    language: "EN",
    category: "ESG",
    priority: "MEDIUM",
    active: true,
  },
  {
    id: "responsible-investor",
    name: "Responsible Investor",
    url: "https://www.responsible-investor.com",
    feedUrl: "https://www.responsible-investor.com/feed/",
    type: "RSS",
    language: "EN",
    category: "ESG",
    priority: "LOW",
    active: true,
  },

  // ── CREDIT / RATINGS ──────────────────────────────────────────────────
  {
    id: "moodys-latam",
    name: "Moody's — Latin America",
    url: "https://www.moodys.com/researchandratings/country/brazil",
    type: "SCRAPE",
    scrapeUrl: "https://www.moodys.com/researchandratings/country/brazil",
    language: "EN",
    category: "CREDIT_RATINGS",
    priority: "HIGH",
    active: true,
  },
];

/**
 * Get active sources filtered by sector relevance.
 */
export function getActiveSources(sector?: string): NewsSource[] {
  return NEWS_SOURCES.filter((s) => {
    if (!s.active) return false;
    if (!sector || !s.sectors?.length) return true;
    return s.sectors.some((sec) => sector.toLowerCase().includes(sec.toLowerCase()));
  });
}
