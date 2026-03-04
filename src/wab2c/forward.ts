import { config } from "../config.js";
import type { ShopSettings } from "../storage/db.js";

export async function forwardToWab2c(args: {
  shop: string;
  topic: string;
  payload: unknown;
  settings: ShopSettings;
}) {
  const url =
    (args.settings.wab2cWebhookUrls && args.settings.wab2cWebhookUrls[args.topic]) ||
    args.settings.wab2cWebhookUrl ||
    config.wab2cWebhookUrl;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-WAB2C-Source": "shopify",
    "X-WAB2C-Shop": args.shop,
    "X-WAB2C-Topic": args.topic
  };

  const headerName = args.settings.authHeaderName || config.wab2cAuthHeaderName;
  const headerValue = args.settings.authHeaderValue || config.wab2cAuthHeaderValue;
  if (headerName && headerValue) headers[headerName] = headerValue;

  const res = await fetch(url, {
    method: "POST",
    headers,
    // Send RAW payload so dashboard mapping can use @field paths directly (like WooCommerce).
    body: JSON.stringify(args.payload)
  });

  if (!res.ok) {
    throw new Error(`WAB2C forward failed: ${res.status} ${await res.text()}`);
  }
}



