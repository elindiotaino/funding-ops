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
  const intro = `Daily Funding Ops summary for ${payload.companyName}\n\nTop relevant items:\n`;
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
      <ol style="padding-left:20px;">${items}</ol>
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
