import { config } from "../config.js";

export type WhatsMarkConfig = {
  domain: string; // without https://
  tenant: string;
  apiToken: string;
};

function baseUrl(domain: string): string {
  const d = (domain || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!d) throw new Error("WhatsMark domain is missing");
  return `https://${d}`;
}

export function getWhatsMarkConfigFromEnv(): WhatsMarkConfig | null {
  if (!config.whatsmarkDomain || !config.whatsmarkTenant || !config.whatsmarkApiToken) return null;
  return { domain: config.whatsmarkDomain, tenant: config.whatsmarkTenant, apiToken: config.whatsmarkApiToken };
}

export async function sendSimpleMessage(args: {
  domain: string;
  tenant: string;
  apiToken: string;
  phoneNumber: string;
  messageBody: string;
}) {
  const url = `${baseUrl(args.domain)}/api/v1/${encodeURIComponent(args.tenant)}/messages/send`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiToken}`
    },
    body: JSON.stringify({
      phone_number: args.phoneNumber,
      message_body: args.messageBody
    })
  });
  if (!res.ok) throw new Error(`WhatsMark send failed: ${res.status} ${await res.text()}`);
  return await res.json().catch(() => ({}));
}

export async function sendTemplateMessage(args: {
  domain: string;
  tenant: string;
  apiToken: string;
  phoneNumber: string;
  templateName: string;
  templateLanguage: string;
  fields?: Record<string, string>;
}) {
  const url = `${baseUrl(args.domain)}/api/v1/${encodeURIComponent(args.tenant)}/messages/template`;

  const form = new FormData();
  form.set("phone_number", args.phoneNumber);
  form.set("template_name", args.templateName);
  form.set("template_language", args.templateLanguage);

  for (const [k, v] of Object.entries(args.fields || {})) {
    if (v === undefined || v === null) continue;
    form.set(k, String(v));
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiToken}`
    },
    body: form
  });
  if (!res.ok) throw new Error(`WhatsMark template send failed: ${res.status} ${await res.text()}`);
  return await res.json().catch(() => ({}));
}

