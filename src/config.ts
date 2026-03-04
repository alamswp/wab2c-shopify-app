import dotenv from "dotenv";

dotenv.config({ path: process.env.ENV_FILE || "env" });

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT || 3000),
  appUrl: required("APP_URL").replace(/\/+$/, ""),
  shopifyApiKey: required("SHOPIFY_API_KEY"),
  shopifyApiSecret: required("SHOPIFY_API_SECRET"),
  shopifyScopes: (process.env.SHOPIFY_SCOPES || "read_orders").split(",").map((s) => s.trim()).filter(Boolean),
  shopifyApiVersion: process.env.SHOPIFY_API_VERSION || "2025-10",
  webhookTopics: (process.env.SHOPIFY_WEBHOOK_TOPICS || "orders/create")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  sqlitePath: process.env.SQLITE_PATH || "./data/app.db",
  wab2cWebhookUrl: required("WAB2C_WEBHOOK_URL"),
  wab2cAuthHeaderName: process.env.WAB2C_AUTH_HEADER_NAME || "",
  wab2cAuthHeaderValue: process.env.WAB2C_AUTH_HEADER_VALUE || "",

  whatsmarkDomain: process.env.WHATSMARK_DOMAIN || "",
  whatsmarkTenant: process.env.WHATSMARK_TENANT || "",
  whatsmarkApiToken: process.env.WHATSMARK_API_TOKEN || "",
  whatsmarkTemplates: {
    "orders/create": process.env.WHATSMARK_TEMPLATE_ORDERS_CREATE || "",
    "orders/cancelled": process.env.WHATSMARK_TEMPLATE_ORDERS_CANCELLED || "",
    "orders/paid": process.env.WHATSMARK_TEMPLATE_ORDERS_PAID || "",
    "orders/fulfilled": process.env.WHATSMARK_TEMPLATE_ORDERS_FULFILLED || "",
    "refunds/create": process.env.WHATSMARK_TEMPLATE_REFUNDS_CREATE || "",
    "orders/updated": process.env.WHATSMARK_TEMPLATE_ORDERS_UPDATED || ""
  } as Record<string, string>
};



