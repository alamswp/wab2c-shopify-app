import type { Request } from "express";
import { config } from "../config.js";
import { hmacBase64, hmacHex, safeEqual } from "./crypto.js";

export function verifyShopifyWebhook(req: Request, rawBody: Buffer): boolean {
  const header = (req.header("X-Shopify-Hmac-Sha256") || "").trim();
  if (!header) return false;
  const computed = hmacBase64(config.shopifyApiSecret, rawBody);
  return safeEqual(header, computed);
}

// Verifies OAuth callback HMAC (querystring)
export function verifyShopifyOAuthQuery(query: Record<string, string | string[] | undefined>): boolean {
  const theirHmac = typeof query.hmac === "string" ? query.hmac : "";
  if (!theirHmac) return false;

  const pairs: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (key === "hmac" || key === "signature") continue;
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) pairs.push(`${key}=${encodeURIComponent(v)}`);
    } else {
      pairs.push(`${key}=${encodeURIComponent(value)}`);
    }
  }
  pairs.sort();
  const message = pairs.join("&");

  const computed = hmacHex(config.shopifyApiSecret, message);
  return safeEqual(theirHmac, computed);
}



