import { inferNaicsCodesFromText } from "../naics.js";

type ClassifyOptions = {
  text: Array<string | null | undefined>;
  hints?: string[];
};

function normalizeCode(code: string) {
  return code.trim();
}

export function classifyNaicsCodes(options: ClassifyOptions) {
  const baseCodes = inferNaicsCodesFromText(
    options.text
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(" "),
  );

  return Array.from(
    new Set([...(options.hints ?? []).map(normalizeCode).filter(Boolean), ...baseCodes]),
  );
}
