import fullNaicsCatalog from "@/data/naics-2022-full.json";

export type NaicsOption = {
  code: string;
  label: string;
  keywords: string[];
};

export type FullNaicsOption = {
  code: string;
  label: string;
  level: number;
};

export const NAICS_OPTIONS: NaicsOption[] = [
  { code: "11", label: "Agriculture, Forestry, Fishing and Hunting", keywords: ["agriculture", "farming", "forestry", "fishing", "aquaculture", "crop", "livestock"] },
  { code: "21", label: "Mining, Quarrying, and Oil and Gas Extraction", keywords: ["mining", "quarry", "oil", "gas", "extraction", "minerals", "drilling"] },
  { code: "22", label: "Utilities", keywords: ["utilities", "electric", "energy", "water", "wastewater", "power grid", "renewable power"] },
  { code: "23", label: "Construction", keywords: ["construction", "contractor", "builder", "infrastructure", "renovation", "repair", "trades"] },
  { code: "31-33", label: "Manufacturing", keywords: ["manufacturing", "factory", "production", "industrial", "assembly", "fabrication", "processing"] },
  { code: "42", label: "Wholesale Trade", keywords: ["wholesale", "distribution", "distributor", "supply chain", "inventory supply", "reseller"] },
  { code: "44-45", label: "Retail Trade", keywords: ["retail", "store", "merchant", "ecommerce", "consumer sales", "shop"] },
  { code: "48-49", label: "Transportation and Warehousing", keywords: ["transportation", "logistics", "warehousing", "freight", "shipping", "delivery", "storage"] },
  { code: "51", label: "Information", keywords: ["information services", "publishing", "software", "telecommunications", "media", "data", "digital platform"] },
  { code: "52", label: "Finance and Insurance", keywords: ["finance", "financial services", "insurance", "banking", "lending", "capital", "investment"] },
  { code: "53", label: "Real Estate and Rental and Leasing", keywords: ["real estate", "property", "housing", "rental", "leasing", "landlord", "development"] },
  { code: "54", label: "Professional, Scientific, and Technical Services", keywords: ["professional services", "technical services", "engineering", "consulting", "software development", "IT", "research"] },
  { code: "55", label: "Management of Companies and Enterprises", keywords: ["holding company", "management company", "corporate management", "enterprise management"] },
  { code: "56", label: "Administrative and Support and Waste Management and Remediation Services", keywords: ["administrative support", "staffing", "waste management", "remediation", "janitorial", "security services", "business support"] },
  { code: "61", label: "Educational Services", keywords: ["education", "training", "school", "curriculum", "learning", "instruction", "workforce training"] },
  { code: "62", label: "Health Care and Social Assistance", keywords: ["health care", "medical", "clinic", "social assistance", "behavioral health", "therapy", "care services"] },
  { code: "71", label: "Arts, Entertainment, and Recreation", keywords: ["arts", "entertainment", "recreation", "creative", "museum", "events", "sports"] },
  { code: "72", label: "Accommodation and Food Services", keywords: ["hospitality", "accommodation", "hotel", "restaurant", "food service", "tourism", "lodging"] },
  { code: "81", label: "Other Services (except Public Administration)", keywords: ["personal services", "repair services", "community services", "nonprofit services", "beauty", "laundry"] },
  { code: "92", label: "Public Administration", keywords: ["public administration", "government operations", "municipal", "agency", "public sector", "civic"] },
];

export const FULL_NAICS_OPTIONS = fullNaicsCatalog as FullNaicsOption[];

const naicsMap = new Map<string, NaicsOption>(NAICS_OPTIONS.map((option) => [option.code, option]));
const fullNaicsMap = new Map<string, FullNaicsOption>(
  FULL_NAICS_OPTIONS.map((option) => [option.code, option]),
);

export function getNaicsSectorCode(code: string) {
  const normalized = code.trim();
  if (!normalized) {
    return null;
  }

  if (naicsMap.has(normalized)) {
    return normalized;
  }

  if (/^(31|32|33)/.test(normalized)) {
    return "31-33";
  }

  if (/^(44|45)/.test(normalized)) {
    return "44-45";
  }

  if (/^(48|49)/.test(normalized)) {
    return "48-49";
  }

  const twoDigit = normalized.slice(0, 2);
  return naicsMap.has(twoDigit) ? twoDigit : null;
}

export function getNaicsOption(code: string) {
  const sectorCode = getNaicsSectorCode(code);
  return sectorCode ? naicsMap.get(sectorCode) : undefined;
}

export function getFullNaicsOption(code: string) {
  return fullNaicsMap.get(code.trim());
}

export function getNaicsKeywords(codes: string[]) {
  return Array.from(
    new Set(
      codes.flatMap((code) => getNaicsOption(code)?.keywords ?? []),
    ),
  );
}

export function naicsCodesMatch(leftCode: string, rightCode: string) {
  const left = leftCode.trim();
  const right = rightCode.trim();
  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  const leftSector = getNaicsSectorCode(left);
  const rightSector = getNaicsSectorCode(right);
  return Boolean(leftSector && rightSector && leftSector === rightSector);
}

export function findCompatibleNaicsCodes(selectedCodes: string[], itemCodes: string[]) {
  return selectedCodes.filter((selectedCode) =>
    itemCodes.some((itemCode) => naicsCodesMatch(selectedCode, itemCode)),
  );
}

export function hasCompatibleNaicsCodes(selectedCodes: string[], itemCodes: string[]) {
  if (selectedCodes.length === 0) {
    return true;
  }

  return findCompatibleNaicsCodes(selectedCodes, itemCodes).length > 0;
}

export function formatNaicsLabel(code: string) {
  const fullOption = getFullNaicsOption(code);
  if (fullOption) {
    return `${fullOption.code} ${fullOption.label}`;
  }

  const option = getNaicsOption(code);
  return option ? `${code} ${option.label}` : code;
}

function getSearchScore(option: FullNaicsOption, normalizedQuery: string) {
  const normalizedCode = option.code.toLowerCase();
  const normalizedLabel = option.label.toLowerCase();

  if (normalizedCode === normalizedQuery) {
    return 0;
  }

  if (normalizedCode.startsWith(normalizedQuery)) {
    return 1;
  }

  if (normalizedLabel.startsWith(normalizedQuery)) {
    return 2;
  }

  const wordIndex = normalizedLabel.indexOf(` ${normalizedQuery}`);
  if (wordIndex >= 0) {
    return 3;
  }

  if (normalizedLabel.includes(normalizedQuery)) {
    return 4;
  }

  if (normalizedCode.includes(normalizedQuery)) {
    return 5;
  }

  return Number.POSITIVE_INFINITY;
}

export function searchFullNaicsCatalog(query: string, limit = 20) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [] as FullNaicsOption[];
  }

  return FULL_NAICS_OPTIONS
    .map((option) => ({
      option,
      score: getSearchScore(option, normalized),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }

      if (left.option.code.length !== right.option.code.length) {
        return left.option.code.length - right.option.code.length;
      }

      return left.option.code.localeCompare(right.option.code);
    })
    .slice(0, limit)
    .map((entry) => entry.option);
}

export function inferNaicsCodesFromText(text: string) {
  const normalized = text.toLowerCase();
  return NAICS_OPTIONS.filter((option) =>
    option.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())),
  ).map((option) => option.code);
}
