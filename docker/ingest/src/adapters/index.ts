import type { SourceDefinition } from "../source-registry.js";
import type { AdapterRunResult } from "../types.js";
import { runGrantsGovAdapter } from "./grants-gov.js";
import { runOpenFemaAdapter } from "./openfema.js";
import { runSamAssistanceAdapter } from "./sam-assistance.js";
import { runSimplerGrantsAdapter } from "./simpler-grants.js";
import { runUsaJobsAdapter } from "./usajobs.js";
import { runUsaSpendingAdapter } from "./usaspending.js";

export async function runSourceAdapter(source: SourceDefinition): Promise<AdapterRunResult> {
  switch (source.key) {
    case "grants-gov":
      return runGrantsGovAdapter(source);
    case "simpler-grants":
      return runSimplerGrantsAdapter(source);
    case "sam-assistance":
      return runSamAssistanceAdapter(source);
    case "usajobs":
      return runUsaJobsAdapter(source);
    case "usaspending":
      return runUsaSpendingAdapter(source);
    case "openfema":
      return runOpenFemaAdapter(source);
    default:
      return {
        status: "skipped",
        reason: `No adapter implemented yet for ${source.key}.`,
      };
  }
}
