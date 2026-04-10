export type IngestedOpportunity = {
  sourceItemId: string;
  canonicalKey: string;
  title: string;
  category: string;
  jurisdiction: string;
  audience: string | null;
  summary: string | null;
  eligibility: string | null;
  amount: string | null;
  deadline: string | null;
  geography: string | null;
  status: string;
  sourceUrl: string;
  sourceDetailUrl?: string | null;
  publishedAt?: string | null;
  keywords: string[];
  tags: string[];
  detailPayload?: Record<string, unknown> | null;
};

export type AdapterRunResult =
  | {
      status: "success";
      items: IngestedOpportunity[];
    }
  | {
      status: "skipped";
      reason: string;
      items?: never;
    };
