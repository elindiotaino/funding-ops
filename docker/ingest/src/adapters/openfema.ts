import { fetchJson } from "../http.js";
import type { SourceDefinition } from "../source-registry.js";
import type { AdapterRunResult, IngestedOpportunity } from "../types.js";
import { classifyNaicsCodes } from "./naics-classification.js";

type OpenFemaResponse = {
  DisasterDeclarationsSummaries?: Array<{
    id?: string;
    femaDeclarationString?: string;
    disasterNumber?: number;
    state?: string;
    declarationDate?: string;
    fyDeclared?: number;
    declarationType?: string;
    disasterType?: string;
    incidentType?: string;
    declarationTitle?: string;
    incidentBeginDate?: string | null;
    incidentEndDate?: string | null;
    designatedArea?: string | null;
    iaProgramDeclared?: boolean | null;
    ihProgramDeclared?: boolean | null;
    paProgramDeclared?: boolean | null;
    hmProgramDeclared?: boolean | null;
    lastRefresh?: string | null;
  }>;
};

function buildPrograms(item: NonNullable<OpenFemaResponse["DisasterDeclarationsSummaries"]>[number]) {
  const programs: string[] = [];

  if (item.iaProgramDeclared) {
    programs.push("Individual Assistance");
  }

  if (item.paProgramDeclared) {
    programs.push("Public Assistance");
  }

  if (item.hmProgramDeclared) {
    programs.push("Hazard Mitigation");
  }

  return programs;
}

export async function runOpenFemaAdapter(source: SourceDefinition): Promise<AdapterRunResult> {
  const url = new URL("https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries");
  url.searchParams.set("$filter", "state eq 'PR'");
  url.searchParams.set("$orderby", "declarationDate desc");
  url.searchParams.set("$top", "25");

  const response = await fetchJson<OpenFemaResponse>(url.toString());

  const items = ((response.DisasterDeclarationsSummaries ?? [])
    .map((item) => {
      const sourceItemId =
        item.id?.trim() ||
        item.femaDeclarationString?.trim() ||
        (item.disasterNumber ? String(item.disasterNumber) : "");
      const title = item.declarationTitle?.trim();

      if (!sourceItemId || !title) {
        return null;
      }

      const programs = buildPrograms(item);
      if (item.ihProgramDeclared) {
        programs.push("Individuals and Households");
      }

      const countyArea = item.designatedArea?.trim() || "Puerto Rico";
      const summary = `${item.incidentType ?? "Disaster"} declaration for ${countyArea}. Programs declared: ${programs.length > 0 ? programs.join(", ") : "none listed"}.`;
      const naicsCodes = classifyNaicsCodes({
        text: [
          title,
          summary,
          item.declarationType,
          item.disasterType,
          item.incidentType,
          countyArea,
          ...programs,
        ],
        hints: ["92", "62"],
      });

      return {
        sourceItemId,
        canonicalKey: `${source.key}:${sourceItemId}`,
        title,
        category: "aid",
        jurisdiction: source.jurisdiction,
        audience: "Municipal teams, resilience operators, emergency support programs",
        summary,
        eligibility: null,
        amount: null,
        deadline: item.incidentEndDate ?? null,
        geography: countyArea,
        status: "declared",
        sourceUrl: item.femaDeclarationString
          ? `https://www.fema.gov/disaster/${encodeURIComponent(String(item.disasterNumber ?? item.femaDeclarationString))}`
          : source.url,
        sourceDetailUrl: item.femaDeclarationString
          ? `https://www.fema.gov/disaster/${encodeURIComponent(String(item.disasterNumber ?? item.femaDeclarationString))}`
          : source.url,
        publishedAt: item.declarationDate ?? null,
        keywords: [
          item.femaDeclarationString,
          item.disasterType,
          item.incidentType,
          item.state,
          item.designatedArea,
          "openfema",
          "puerto rico",
        ].filter((value): value is string => Boolean(value && value.trim())),
        tags: ["aid", "recovery", "resilience", "puerto-rico", "fema"],
        naicsCodes,
        detailPayload: {
          declarationString: item.femaDeclarationString ?? null,
          disasterNumber: item.disasterNumber ?? null,
          declarationType: item.declarationType ?? null,
          declarationDate: item.declarationDate ?? null,
          fiscalYearDeclared: item.fyDeclared ?? null,
          disasterType: item.disasterType ?? null,
          incidentType: item.incidentType ?? null,
          incidentBeginDate: item.incidentBeginDate ?? null,
          incidentEndDate: item.incidentEndDate ?? null,
          designatedArea: item.designatedArea ?? null,
          programsDeclared: programs,
          lastRefresh: item.lastRefresh ?? null,
        },
      } satisfies IngestedOpportunity;
    }) as Array<IngestedOpportunity | null>)
    .filter((item): item is IngestedOpportunity => item !== null);

  return {
    status: "success",
    items,
  };
}
