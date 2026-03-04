import crypto from "node:crypto";
import { config } from "../config.js";

export function normalizeShop(shop: string): string {
  const s = (shop || "").trim().toLowerCase();
  if (!s.endsWith(".myshopify.com")) throw new Error("Invalid shop domain");
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s)) throw new Error("Invalid shop domain");
  return s;
}

export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function buildAuthUrl(shop: string, state: string): string {
  const redirectUri = `${config.appUrl}/auth/callback`;
  const scopes = config.shopifyScopes.join(",");
  const u = new URL(`https://${shop}/admin/oauth/authorize`);
  u.searchParams.set("client_id", config.shopifyApiKey);
  u.searchParams.set("scope", scopes);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeAccessToken(shop: string, code: string): Promise<string> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.shopifyApiKey,
      client_secret: config.shopifyApiSecret,
      code
    })
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string };
  if (!json.access_token) throw new Error("Token exchange missing access_token");
  return json.access_token;
}

export async function registerWebhook(
  shop: string,
  accessToken: string,
  topic: string,
  address: string
): Promise<void> {
  const apiVersion = config.shopifyApiVersion;
  const res = await fetch(`https://${shop}/admin/api/${apiVersion}/webhooks.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken
    },
    body: JSON.stringify({
      webhook: {
        topic,
        address,
        format: "json"
      }
    })
  });

  // Shopify returns 201 if created, 422 if already exists with same address/topic sometimes.
  if (res.ok) return;
  const txt = await res.text();
  if (res.status === 422 && txt.toLowerCase().includes("address")) return;
  throw new Error(`Webhook register failed (${topic}): ${res.status} ${txt}`);
}

export async function registerAllWebhooks(shop: string, accessToken: string): Promise<void> {
  const address = `${config.appUrl}/webhooks`;
  for (const topic of config.webhookTopics) {
    await registerWebhook(shop, accessToken, topic, address);
  }
}



