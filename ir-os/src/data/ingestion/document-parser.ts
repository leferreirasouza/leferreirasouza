/**
 * DOCUMENT PARSER
 *
 * Extracts plain text from uploaded files.
 * Supported: PDF, Word (.docx), Excel (.xlsx/.xls), plain text, markdown.
 *
 * Returns structured ParsedDocument ready to be stored in the repository.
 */

import { readFileSync } from "fs";
import { extname, basename } from "path";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

export interface ParsedDocument {
  title: string;
  rawText: string;
  pageCount?: number;
  wordCount: number;
  language: "PT" | "EN" | "UNKNOWN";
  detectedDocType: DocumentTypeGuess;
  detectedPeriod?: { year?: number; quarter?: 1|2|3|4; label?: string };
  parseMethod: string;
}

export type DocumentTypeGuess =
  | "PRESS_RELEASE"
  | "ANNUAL_REPORT"
  | "QUARTERLY_REPORT"
  | "PRESENTATION"
  | "FATO_RELEVANTE"
  | "EARNINGS_SCRIPT"
  | "ANALYST_REPORT"
  | "FINANCIAL_MODEL"
  | "REGULATORY_FILING"
  | "OTHER";

export async function parseFile(filePath: string): Promise<ParsedDocument> {
  const ext = extname(filePath).toLowerCase();
  const fileName = basename(filePath);

  let rawText = "";
  let pageCount: number | undefined;
  let parseMethod = "unknown";

  switch (ext) {
    case ".pdf": {
      const buffer = readFileSync(filePath);
      const result = await pdfParse(buffer);
      rawText = result.text;
      pageCount = result.numpages;
      parseMethod = "pdf-parse";
      break;
    }

    case ".docx":
    case ".doc": {
      const result = await mammoth.extractRawText({ path: filePath });
      rawText = result.value;
      parseMethod = "mammoth";
      break;
    }

    case ".xlsx":
    case ".xls": {
      const workbook = XLSX.readFile(filePath);
      const parts: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        parts.push(`=== Sheet: ${sheetName} ===\n${csv}`);
      }
      rawText = parts.join("\n\n");
      parseMethod = "xlsx";
      break;
    }

    case ".txt":
    case ".md": {
      rawText = readFileSync(filePath, "utf8");
      parseMethod = "plain-text";
      break;
    }

    default:
      throw new Error(`Unsupported file type: ${ext}. Supported: .pdf, .docx, .doc, .xlsx, .xls, .txt, .md`);
  }

  rawText = cleanText(rawText);
  const wordCount = rawText.split(/\s+/).filter(Boolean).length;

  return {
    title: inferTitle(fileName, rawText),
    rawText,
    pageCount,
    wordCount,
    language: detectLanguage(rawText),
    detectedDocType: inferDocType(fileName, rawText),
    detectedPeriod: inferPeriod(fileName, rawText),
    parseMethod,
  };
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{3,}/g, " ")
    .trim();
}

function inferTitle(fileName: string, text: string): string {
  // Try first non-empty line of content
  const firstLine = text.split("\n").find((l) => l.trim().length > 10);
  if (firstLine && firstLine.length < 120) return firstLine.trim();
  // Fall back to filename without extension
  return basename(fileName, extname(fileName)).replace(/[-_]/g, " ");
}

function detectLanguage(text: string): "PT" | "EN" | "UNKNOWN" {
  const ptWords = ["de", "da", "do", "em", "para", "com", "que", "os", "as", "uma", "empresa", "receita", "lucro", "resultado"];
  const enWords = ["the", "and", "of", "to", "in", "for", "with", "that", "revenue", "income", "result", "quarter"];
  const sample = text.slice(0, 2000).toLowerCase();
  const ptCount = ptWords.filter((w) => sample.includes(` ${w} `)).length;
  const enCount = enWords.filter((w) => sample.includes(` ${w} `)).length;
  if (ptCount > enCount + 2) return "PT";
  if (enCount > ptCount + 2) return "EN";
  return "UNKNOWN";
}

function inferDocType(fileName: string, text: string): DocumentTypeGuess {
  const lower = (fileName + " " + text.slice(0, 1000)).toLowerCase();

  if (/fato.?relevante|material.?fact|fato_relevante/.test(lower)) return "FATO_RELEVANTE";
  if (/press.?release|comunicado.?ao.?mercado|earnings.?release/.test(lower)) return "PRESS_RELEASE";
  if (/relat.rio.?anual|annual.?report|dfp|20.?f/.test(lower)) return "ANNUAL_REPORT";
  if (/itr|6.?k|quarter|trimestre|resultado/.test(lower)) return "QUARTERLY_REPORT";
  if (/apresenta|presentation|investor.?day|roadshow/.test(lower)) return "PRESENTATION";
  if (/script|prepared.?remarks|conference.?call/.test(lower)) return "EARNINGS_SCRIPT";
  if (/analyst|broker|research|target.?price/.test(lower)) return "ANALYST_REPORT";
  if (/modelo|model|valuation|dcf|\.xlsx/.test(lower)) return "FINANCIAL_MODEL";
  if (/formulario|reference.?form|20.?f|proxy/.test(lower)) return "REGULATORY_FILING";

  return "OTHER";
}

function inferPeriod(
  fileName: string,
  text: string
): { year?: number; quarter?: 1|2|3|4; label?: string } | undefined {
  const combined = fileName + " " + text.slice(0, 500);

  // Match patterns like "4Q25", "3T24", "4Q2025", "Q3 2025", "T4 2025"
  const qMatch = combined.match(/([1-4])[QTqt][-_\s]?(\d{2,4})|[QTqt]([1-4])[-_\s]?(\d{2,4})/);
  if (qMatch) {
    const q = parseInt(qMatch[1] ?? qMatch[3]) as 1|2|3|4;
    const rawYear = qMatch[2] ?? qMatch[4];
    const year = rawYear.length === 2 ? 2000 + parseInt(rawYear) : parseInt(rawYear);
    return { year, quarter: q, label: `${q}Q${String(year).slice(2)}` };
  }

  // Match full year: "FY2025", "2025", "Exercício 2025"
  const yearMatch = combined.match(/(?:fy|exerc[íi]cio|annual|anual)[-_\s]?(\d{4})|(\b20\d{2}\b)/i);
  if (yearMatch) {
    const year = parseInt(yearMatch[1] ?? yearMatch[2]);
    if (year >= 2000 && year <= 2035) return { year, label: `FY${String(year).slice(2)}` };
  }

  return undefined;
}
