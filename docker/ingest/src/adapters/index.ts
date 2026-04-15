import type { SourceDefinition } from "../source-registry.js";
import type { AdapterRunResult, IngestedOpportunity, RefreshScope } from "../types.js";
import { hasCompatibleNaicsCodes } from "../naics.js";
import { runGrantsGovAdapter } from "./grants-gov.js";
import { runOpenFemaAdapter } from "./openfema.js";
import { runSamAssistanceAdapter } from "./sam-assistance.js";
import { runSimplerGrantsAdapter } from "./simpler-grants.js";
import { runUsaJobsAdapter } from "./usajobs.js";
import { runUsaSpendingAdapter } from "./usaspending.js";

function applyScope(items: IngestedOpportunity[], scope?: RefreshScope) {
  if (!scope || scope.naicsCodes.length === 0) {
    return items;
  }

  const normalizedKeywords = scope.keywords.map((keyword) => keyword.toLowerCase());
  return items.filter((item) => {
    if (hasCompatibleNaicsCodes(scope.naicsCodes, item.naicsCodes ?? [])) {
      return true;
    }

    const haystack = [
      item.title,
      item.summary,
      item.eligibility,
      item.audience,
      item.geography,
      ...item.keywords,
      ...item.tags,
    ]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(" ")
      .toLowerCase();

    return normalizedKeywords.some((keyword) => haystack.includes(keyword));
  });
}

export async function runSourceAdapter(
  source: SourceDefinition,
  scope?: RefreshScope,
): Promise<AdapterRunResult> {
  let result: AdapterRunResult;
  switch (source.key) {
    case "grants-gov":
      result = await runGrantsGovAdapter(source, scope);
      break;
    case "simpler-grants":
      result = await runSimplerGrantsAdapter(source);
      break;
    case "sam-assistance":
      result = await runSamAssistanceAdapter(source);
      break;
    case "usajobs":
      result = await runUsaJobsAdapter(source, scope);
      break;
    case "usaspending":
      result = await runUsaSpendingAdapter(source);
      break;
    case "openfema":
      result = await runOpenFemaAdapter(source);
      break;
    default:
      return {
        status: "skipped",
        reason: `No adapter implemented yet for ${source.key}.`,
      };
  }

  if (result.status !== "success") {
    return result;
  }

  return {
    status: "success",
    items: applyScope(result.items, scope),
  };
}
