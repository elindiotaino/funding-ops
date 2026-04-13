import { NextResponse } from "next/server";

import { requireFundingOpsApiAccess } from "@/lib/auth/access";
import { NAICS_OPTIONS } from "@/lib/naics";

type NaicsSearchResult = {
  code: string;
  label: string;
};

const EXACT_NAICS_CODE_PATTERN = /^\d{2,6}$/;

const LOCAL_NAICS_RESULTS = NAICS_OPTIONS.map((option) => ({
  code: option.code,
  label: option.label,
}));

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value: string) {
  return decodeEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function dedupeResults(results: NaicsSearchResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.code}::${result.label}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function searchLocalNaics(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [] as NaicsSearchResult[];
  }

  return LOCAL_NAICS_RESULTS.filter(
    (option) =>
      option.code.toLowerCase().includes(normalized) ||
      option.label.toLowerCase().includes(normalized),
  ).slice(0, 20);
}

function parseOfficialNaicsResults(html: string) {
  const matches = Array.from(
    html.matchAll(/<a[^>]+href="\/naics\/\?[^"]*details=([^"&]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi),
  );

  const results = matches
    .map((match) => {
      const code = stripHtml(match[1] ?? "").trim();
      const rawText = stripHtml(match[2] ?? "");
      const label = rawText.replace(new RegExp(`^${code}\\s*-?\\s*`), "").trim();
      if (!code || !label) {
        return null;
      }

      return { code, label };
    })
    .filter((result): result is NaicsSearchResult => Boolean(result));

  return dedupeResults(results).slice(0, 20);
}

function parseOfficialNaicsDetail(code: string, html: string) {
  const normalizedCode = code.trim();
  if (!normalizedCode) {
    return null;
  }

  const headerPatterns = [
    new RegExp(
      `<h[1-6][^>]*>[\\s\\S]*?${normalizedCode}\\s*(?:<sup[^>]*>[\\s\\S]*?<\\/sup>)?\\s*([^<]+?)<\\/h[1-6]>`,
      "i",
    ),
    new RegExp(
      `<a[^>]+name="${normalizedCode}"[^>]*>[\\s\\S]*?<\\/a>[\\s\\S]*?<h[1-6][^>]*>\\s*${normalizedCode}\\s*(?:<sup[^>]*>[\\s\\S]*?<\\/sup>)?\\s*([^<]+?)<\\/h[1-6]>`,
      "i",
    ),
    new RegExp(
      `>${normalizedCode}\\s*(?:<sup[^>]*>[\\s\\S]*?<\\/sup>)?\\s*([^<]{3,200}?)<`,
      "i",
    ),
  ];

  for (const pattern of headerPatterns) {
    const match = html.match(pattern);
    if (!match) {
      continue;
    }

    const label = stripHtml(match[1] ?? "").trim();
    if (label) {
      return { code: normalizedCode, label };
    }
  }

  return null;
}

function buildArchiveSectorCandidates(code: string) {
  const twoDigit = code.slice(0, 2);
  const candidates = [twoDigit];

  if (twoDigit === "32" || twoDigit === "33") {
    candidates.push("31");
  }

  if (twoDigit === "45") {
    candidates.push("44");
  }

  if (twoDigit === "49") {
    candidates.push("48");
  }

  return Array.from(new Set(candidates));
}

async function fetchOfficialNaicsDetail(code: string) {
  for (const sector of buildArchiveSectorCandidates(code)) {
    const response = await fetch(`https://www.census.gov/naics/resources/archives/sect${sector}.html`, {
      headers: {
        "user-agent": "FundingOps/1.0 NAICS lookup",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      continue;
    }

    const html = await response.text();
    const detail = parseOfficialNaicsDetail(code, html);
    if (detail) {
      return detail;
    }
  }

  return null;
}

async function fetchOfficialNaics(query: string) {
  if (EXACT_NAICS_CODE_PATTERN.test(query)) {
    const detail = await fetchOfficialNaicsDetail(query);
    if (detail) {
      return [detail];
    }
  }

  const response = await fetch(
    `https://www.census.gov/naics/?input=${encodeURIComponent(query)}&year=2022`,
    {
      headers: {
        "user-agent": "FundingOps/1.0 NAICS lookup",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Official NAICS lookup failed with status ${response.status}.`);
  }

  const html = await response.text();
  const results = parseOfficialNaicsResults(html);

  if (results.length > 0) {
    return results;
  }

  const pageTitleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const pageTitle = pageTitleMatch ? stripHtml(pageTitleMatch[1]) : "";
  const detailMatch = pageTitle.match(/-\s*([0-9A-Z-]{2,8})\s*-\s*(.+)$/i);
  if (detailMatch) {
    return [
      {
        code: detailMatch[1].trim(),
        label: detailMatch[2].trim(),
      },
    ];
  }

  if (EXACT_NAICS_CODE_PATTERN.test(query)) {
    const detail = await fetchOfficialNaicsDetail(query);
    if (detail) {
      return [detail];
    }
  }

  return [];
}

export async function GET(request: Request) {
  const access = await requireFundingOpsApiAccess();
  if (!access.ok) {
    return access.response;
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const codes = Array.from(
    new Set(
      (searchParams.get("codes") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

  if (!query && codes.length === 0) {
    return NextResponse.json({ results: [] });
  }

  try {
    if (codes.length > 0) {
      const localMap = new Map(LOCAL_NAICS_RESULTS.map((option) => [option.code, option]));
      const resolved: NaicsSearchResult[] = [];

      for (const code of codes.slice(0, 50)) {
        const local = localMap.get(code);
        if (local) {
          resolved.push(local);
          continue;
        }

        const officialResults = await fetchOfficialNaics(code);
        const exact = officialResults.find((result) => result.code === code) ?? officialResults[0];
        if (exact) {
          resolved.push(exact);
        } else {
          resolved.push({ code, label: code });
        }
      }

      return NextResponse.json({ results: dedupeResults(resolved) });
    }

    const localResults = searchLocalNaics(query);
    const officialResults = await fetchOfficialNaics(query);
    return NextResponse.json({
      results: dedupeResults([...localResults, ...officialResults]).slice(0, 20),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not search NAICS codes.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
