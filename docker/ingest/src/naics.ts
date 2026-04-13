const NAICS_OPTIONS = [
  { code: "11", keywords: ["agriculture", "farming", "forestry", "fishing", "aquaculture", "crop", "livestock"] },
  { code: "21", keywords: ["mining", "quarry", "oil", "gas", "extraction", "minerals", "drilling"] },
  { code: "22", keywords: ["utilities", "electric", "energy", "water", "wastewater", "power grid", "renewable power"] },
  { code: "23", keywords: ["construction", "contractor", "builder", "infrastructure", "renovation", "repair", "trades"] },
  { code: "31-33", keywords: ["manufacturing", "factory", "production", "industrial", "assembly", "fabrication", "processing"] },
  { code: "42", keywords: ["wholesale", "distribution", "distributor", "supply chain", "inventory supply", "reseller"] },
  { code: "44-45", keywords: ["retail", "store", "merchant", "ecommerce", "consumer sales", "shop"] },
  { code: "48-49", keywords: ["transportation", "logistics", "warehousing", "freight", "shipping", "delivery", "storage"] },
  { code: "51", keywords: ["information services", "publishing", "software", "telecommunications", "media", "data", "digital platform"] },
  { code: "52", keywords: ["finance", "financial services", "insurance", "banking", "lending", "capital", "investment"] },
  { code: "53", keywords: ["real estate", "property", "housing", "rental", "leasing", "landlord", "development"] },
  { code: "54", keywords: ["professional services", "technical services", "engineering", "consulting", "software development", "it", "research"] },
  { code: "55", keywords: ["holding company", "management company", "corporate management", "enterprise management"] },
  { code: "56", keywords: ["administrative support", "staffing", "waste management", "remediation", "janitorial", "security services", "business support"] },
  { code: "61", keywords: ["education", "training", "school", "curriculum", "learning", "instruction", "workforce training"] },
  { code: "62", keywords: ["health care", "medical", "clinic", "social assistance", "behavioral health", "therapy", "care services"] },
  { code: "71", keywords: ["arts", "entertainment", "recreation", "creative", "museum", "events", "sports"] },
  { code: "72", keywords: ["hospitality", "accommodation", "hotel", "restaurant", "food service", "tourism", "lodging"] },
  { code: "81", keywords: ["personal services", "repair services", "community services", "nonprofit services", "beauty", "laundry"] },
  { code: "92", keywords: ["public administration", "government operations", "municipal", "agency", "public sector", "civic"] },
] as const;

const naicsMap = new Map(NAICS_OPTIONS.map((option) => [option.code, option]));

export function inferNaicsCodesFromText(text: string) {
  const normalized = text.toLowerCase();
  return NAICS_OPTIONS
    .filter((option) =>
      option.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())),
    )
    .map((option) => option.code);
}

export function getNaicsKeywords(codes: string[]) {
  return Array.from(
    new Set(codes.flatMap((code) => naicsMap.get(code as (typeof NAICS_OPTIONS)[number]["code"])?.keywords ?? [])),
  );
}
