/**
 * NEWS SCRAPER
 *
 * Fetches news items from:
 *  - RSS / Atom feeds (primary — via XML parsing)
 *  - HTML pages (fallback scrape for sources without feeds)
 *
 * Returns raw, unscored RawNewsItem[] ready for the relevance-scoring
 * step inside the News Intelligence Agent.
 */

import axios from "axios";
import * as cheerio from "cheerio";
import pLimit from "p-limit";
import type { NewsSource } from "../../agents/news-intelligence/sources";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface RawNewsItem {
  sourceId: string;
  sourceName: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string;        // ISO 8601
  language: "PT" | "EN" | "ES";
  category: string;
  sectors: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const USER_AGENT  = "IR-OS/0.1 NewsMonitor";
const TIMEOUT_MS  = 15_000;
const CONCURRENCY = 4;
const MAX_ITEMS_PER_SOURCE = 40;

// ────────────────────────────────────────────────────────────────────────────
// RSS / Atom parser
// ────────────────────────────────────────────────────────────────────────────

function parseRSS(xml: string, source: NewsSource): RawNewsItem[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items: RawNewsItem[] = [];

  // RSS 2.0 uses <item>, Atom 1.0 uses <entry>
  const elements = $("item").length > 0 ? $("item") : $("entry");

  elements.each((_i, el) => {
    const $el = $(el);

    const title = $el.find("title").first().text().trim();

    // Link: Atom uses href attr, RSS uses text node; guid is a last resort
    const link =
      $el.find("link[href]").first().attr("href") ??
      $el.find("link").first().text().trim() ??
      $el.find("guid[isPermaLink!='false']").first().text().trim() ??
      "";

    if (!title || !link) return;

    // Summary: try several common fields
    const rawDesc =
      $el.find("description").first().text() ||
      $el.find("summary").first().text() ||
      $el.find("content").first().text() ||
      "";
    // Strip any embedded HTML tags
    const summary = cheerio.load(rawDesc).text().replace(/\s+/g, " ").trim().slice(0, 800);

    // Published date
    const rawDate =
      $el.find("pubDate").first().text() ||
      $el.find("published").first().text() ||
      $el.find("updated").first().text() ||
      "";
    let publishedAt: string;
    try {
      publishedAt = rawDate ? new Date(rawDate).toISOString() : new Date().toISOString();
    } catch {
      publishedAt = new Date().toISOString();
    }

    items.push({
      sourceId:    source.id,
      sourceName:  source.name,
      title,
      summary,
      url:         link,
      publishedAt,
      language:    source.language,
      category:    source.category,
      sectors:     source.sectors ?? [],
    });
  });

  return items.slice(0, MAX_ITEMS_PER_SOURCE);
}

// ────────────────────────────────────────────────────────────────────────────
// HTML scrape fallback
// ────────────────────────────────────────────────────────────────────────────

function scrapeLinks(html: string, source: NewsSource, baseUrl: string): RawNewsItem[] {
  const $ = cheerio.load(html);
  const items: RawNewsItem[] = [];
  const seen = new Set<string>();

  // Try progressively broader selectors until we get results
  const selectors = [
    "article a[href]",
    ".article a[href]",
    "h2 a[href]",
    "h3 a[href]",
    ".titulo a[href]",
    ".noticia a[href]",
    ".news-item a[href]",
    ".post-title a[href]",
    ".entry-title a[href]",
    "li a[href]",
  ];

  for (const sel of selectors) {
    $(sel).each((_i, el) => {
      const href  = $(el).attr("href");
      const text  = $(el).text().replace(/\s+/g, " ").trim();

      if (!href || text.length < 20) return;

      // Resolve relative URLs safely
      let url: string;
      try {
        url = href.startsWith("http") ? href : new URL(href, baseUrl).href;
      } catch {
        return;
      }

      // Skip non-article resources and duplicates
      if (seen.has(url)) return;
      if (/\.(jpg|jpeg|png|gif|svg|webp|css|js|ico|pdf)(\?|$)/i.test(url)) return;
      seen.add(url);

      items.push({
        sourceId:    source.id,
        sourceName:  source.name,
        title:       text,
        summary:     "",
        url,
        publishedAt: new Date().toISOString(),
        language:    source.language,
        category:    source.category,
        sectors:     source.sectors ?? [],
      });
    });

    if (items.length >= 10) break;
  }

  return items.slice(0, MAX_ITEMS_PER_SOURCE);
}

// ────────────────────────────────────────────────────────────────────────────
// Fetch one source
// ────────────────────────────────────────────────────────────────────────────

async function fetchSource(source: NewsSource): Promise<RawNewsItem[]> {
  const targetUrl = source.feedUrl ?? source.scrapeUrl;
  if (!targetUrl) return [];

  try {
    const { data, headers } = await axios.get<string>(targetUrl, {
      headers:      { "User-Agent": USER_AGENT },
      timeout:      TIMEOUT_MS,
      responseType: "text",
      // Follow up to 3 redirects
      maxRedirects: 3,
    });

    const contentType = ((headers["content-type"] as string) ?? "").toLowerCase();

    // Treat as RSS if declared or if source type is RSS, or if XML-looking
    const isXml =
      source.type === "RSS" ||
      contentType.includes("xml") ||
      contentType.includes("rss") ||
      contentType.includes("atom") ||
      (typeof data === "string" && data.trimStart().startsWith("<"));

    if (isXml) {
      const parsed = parseRSS(data, source);
      if (parsed.length > 0) return parsed;
    }

    // Fall back to HTML scrape (handles SCRAPE sources and any RSS that failed)
    return scrapeLinks(data, source, source.url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[NEWS-SCRAPER] ${source.id}: ${msg}`);
    return [];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all provided sources concurrently (rate-limited to CONCURRENCY).
 * Returns a flat deduplicated array (by URL) sorted by publishedAt desc.
 */
export async function fetchAllSources(sources: NewsSource[]): Promise<RawNewsItem[]> {
  const limit   = pLimit(CONCURRENCY);
  const batches = await Promise.all(sources.map((s) => limit(() => fetchSource(s))));
  const flat    = batches.flat();

  // Global dedup by URL
  const seen = new Set<string>();
  const unique = flat.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  // Sort newest first
  unique.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return unique;
}

export { fetchSource };
