import nodemailer from "nodemailer";

type DailySummaryItem = {
  title: string;
  url: string;
  relevanceScore: number;
  reasons: string[];
  category: string;
  jurisdiction: string;
  deadline: string | null;
};

type DailySummaryPayload = {
  companyName: string;
  email: string;
  snapshotDate: string;
  profileNaicsLabels: string[];
  appUrl: string;
  opportunitiesUrl: string;
  totalAvailable: number;
  unevaluatedItems: number;
  evaluatedItems: number;
  appliedItems: number;
  topReviewReasons: Array<{
    reason: string;
    count: number;
  }>;
  newItems: number;
  recommendedItems: number;
  items: DailySummaryItem[];
};

function formatDeadline(deadline: string | null) {
  if (!deadline) {
    return "No fixed deadline";
  }

  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) {
    return deadline;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildTextBody(payload: DailySummaryPayload) {
  const intro =
    `Daily Funding Ops summary for ${payload.companyName}\n` +
    `Snapshot date: ${payload.snapshotDate}\n` +
    `Account NAICS scope: ${payload.profileNaicsLabels.length > 0 ? payload.profileNaicsLabels.join(", ") : "No NAICS codes selected"}\n` +
    `Total matching opportunities: ${payload.totalAvailable}\n` +
    `Still to evaluate: ${payload.unevaluatedItems}\n` +
    `Already evaluated: ${payload.evaluatedItems}\n` +
    `Applied: ${payload.appliedItems}\n` +
    `Top review reasons: ${payload.topReviewReasons.length > 0 ? payload.topReviewReasons.map((entry) => `${entry.reason} (${entry.count})`).join(", ") : "No review reasons saved yet"}\n` +
    `New since last summary: ${payload.newItems}\n` +
    `Recommended unevaluated matches: ${payload.recommendedItems}\n` +
    `Open full ranked feed: ${payload.opportunitiesUrl}\n` +
    `Open app home: ${payload.appUrl}\n\n` +
    `Top unevaluated items:\n`;
  const items = payload.items
    .map(
      (item, index) =>
        `${index + 1}. ${item.title}\n` +
        `   Score: ${item.relevanceScore}\n` +
        `   Category: ${item.category}\n` +
        `   Jurisdiction: ${item.jurisdiction}\n` +
        `   Deadline: ${formatDeadline(item.deadline)}\n` +
        `   Reasons: ${item.reasons.join(" | ")}\n` +
        `   URL: ${item.url}`,
    )
    .join("\n\n");

  return `${intro}${items}`;
}

function buildHtmlBody(payload: DailySummaryPayload) {
  const items = payload.items
    .map(
      (item) => `
        <li style="margin-bottom:16px;">
          <strong>${item.title}</strong><br />
          Score: ${item.relevanceScore}<br />
          Category: ${item.category}<br />
          Jurisdiction: ${item.jurisdiction}<br />
          Deadline: ${formatDeadline(item.deadline)}<br />
          Reasons: ${item.reasons.join(" | ")}<br />
          <a href="${item.url}">Open source item</a>
        </li>
      `,
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;">
      <h1 style="margin-bottom:8px;">Daily Funding Ops Summary</h1>
      <p style="margin-top:0;">Top relevant items for ${payload.companyName}.</p>
      <p style="margin:16px 0;">
        <a
          href="${payload.opportunitiesUrl}"
          style="display:inline-block;padding:12px 18px;border-radius:999px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;margin-right:10px;"
        >
          Review Full Ranked Feed
        </a>
        <a
          href="${payload.appUrl}"
          style="display:inline-block;padding:12px 18px;border-radius:999px;border:1px solid #0f766e;color:#0f766e;text-decoration:none;font-weight:700;"
        >
          Open Funding Ops
        </a>
      </p>
      <ul style="padding-left:20px;">
        <li>Snapshot date: ${payload.snapshotDate}</li>
        <li>Account NAICS scope: ${payload.profileNaicsLabels.length > 0 ? payload.profileNaicsLabels.join(", ") : "No NAICS codes selected"}</li>
        <li>Total matching opportunities: ${payload.totalAvailable}</li>
        <li>Still to evaluate: ${payload.unevaluatedItems}</li>
        <li>Already evaluated: ${payload.evaluatedItems}</li>
        <li>Applied: ${payload.appliedItems}</li>
        <li>Top review reasons: ${payload.topReviewReasons.length > 0 ? payload.topReviewReasons.map((entry) => `${entry.reason} (${entry.count})`).join(", ") : "No review reasons saved yet"}</li>
        <li>New since last summary: ${payload.newItems}</li>
        <li>Recommended unevaluated matches: ${payload.recommendedItems}</li>
      </ul>
      <ol style="padding-left:20px;">${items}</ol>
      <p style="margin-top:24px;">
        Continue reviewing: <a href="${payload.opportunitiesUrl}">${payload.opportunitiesUrl}</a>
      </p>
    </div>
  `;
}

export async function sendDailySummaryEmail(payload: DailySummaryPayload) {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? "465");
  const secure = (process.env.SMTP_SECURE ?? "true").trim().toLowerCase() === "true";
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.NOTIFICATION_FROM_EMAIL?.trim();

  if (!host || !user || !pass || !from) {
    return {
      sent: false as const,
      skipped: true as const,
      reason: "Missing SMTP_HOST, SMTP_USER, SMTP_PASS, or NOTIFICATION_FROM_EMAIL.",
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  await transporter.sendMail({
    from,
    to: payload.email,
    subject: `Daily Funding Ops Summary for ${payload.companyName}`,
    text: buildTextBody(payload),
    html: buildHtmlBody(payload),
  });

  return {
    sent: true as const,
    skipped: false as const,
  };
}
