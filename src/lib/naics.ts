export type NaicsOption = {
  code: string;
  label: string;
  keywords: string[];
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

const naicsMap = new Map(NAICS_OPTIONS.map((option) => [option.code, option]));

export function getNaicsOption(code: string) {
  return naicsMap.get(code);
}

export function getNaicsKeywords(codes: string[]) {
  return Array.from(
    new Set(
      codes.flatMap((code) => getNaicsOption(code)?.keywords ?? []),
    ),
  );
}

export function formatNaicsLabel(code: string) {
  const option = getNaicsOption(code);
  return option ? `${option.code} ${option.label}` : code;
}

export function inferNaicsCodesFromText(text: string) {
  const normalized = text.toLowerCase();
  return NAICS_OPTIONS.filter((option) =>
    option.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())),
  ).map((option) => option.code);
}
