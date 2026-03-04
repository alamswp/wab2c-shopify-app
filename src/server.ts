import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { config } from "./config.js";
import { buildAuthUrl, exchangeAccessToken, generateState, normalizeShop, registerAllWebhooks } from "./shopify/admin.js";
import { verifyShopifyOAuthQuery, verifyShopifyWebhook } from "./shopify/verify.js";
import {
  consumeOAuthState,
  getShopInstalledAt,
  getShopSettings,
  getShopToken,
  saveOAuthState,
  upsertShopSettings,
  upsertShopToken
} from "./storage/db.js";
import { forwardToWab2c } from "./wab2c/forward.js";
import { sendSimpleMessage, sendTemplateMessage } from "./whatsmark/client.js";
import { buildShopifyContext, renderPlaceholders } from "./wab2c/placeholders.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = __dirname; // server.ts lives in src/

function signSession(shop: string, installedAt: string): string {
  return crypto.createHmac("sha256", config.shopifyApiSecret).update(`${shop}|${installedAt}`).digest("hex");
}

function requireSession(shop: string, session: string | undefined): boolean {
  const installedAt = getShopInstalledAt(shop);
  if (!installedAt) return false;
  const expected = signSession(shop, installedAt);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(session || "", "utf8"));
  } catch {
    return false;
  }
}

function trySignSessionFromShop(shop: string): string | null {
  const installedAt = getShopInstalledAt(shop);
  if (!installedAt) return null;
  return signSession(shop, installedAt);
}

function isValidShopifySignedQuery(req: express.Request): boolean {
  // When Shopify loads an embedded app, it includes shop/host/timestamp/hmac in the query.
  // We can verify this signature to allow access without our custom session param.
  try {
    return verifyShopifyOAuthQuery(req.query as any);
  } catch {
    return false;
  }
}

app.get("/", (req, res) => {
  // If opened from Shopify Admin with a signed query, redirect into settings with a server-generated session.
  try {
    const shop = normalizeShop(String(req.query.shop || ""));
    if (isValidShopifySignedQuery(req)) {
      const session = trySignSessionFromShop(shop);
      if (session) {
        return res.redirect(`/settings?shop=${encodeURIComponent(shop)}&session=${encodeURIComponent(session)}`);
      }
    }
  } catch {
    // ignore and show landing page
  }

  res.type("html").send(`
    <html>
      <head><meta charset="utf-8"><title>WAB2C Shopify App</title></head>
      <body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px;">
        <h2>WAB2C Shopify App</h2>
        <p>Install URL:</p>
        <pre>GET ${config.appUrl}/auth?shop=your-store.myshopify.com</pre>
        <p>After install, you'll be redirected to the Settings page.</p>
      </body>
    </html>
  `);
});

// Start OAuth
app.get("/auth", (req, res) => {
  const shop = normalizeShop(String(req.query.shop || ""));
  const state = generateState();
  saveOAuthState(shop, state);
  const url = buildAuthUrl(shop, state);
  res.redirect(url);
});

// OAuth callback
app.get("/auth/callback", async (req, res) => {
  const shop = normalizeShop(String(req.query.shop || ""));
  const code = String(req.query.code || "");
  const state = String(req.query.state || "");

  if (!verifyShopifyOAuthQuery(req.query as any)) return res.status(401).send("Invalid HMAC");
  if (!consumeOAuthState(shop, state)) return res.status(401).send("Invalid state");
  if (!code) return res.status(400).send("Missing code");

  try {
    const accessToken = await exchangeAccessToken(shop, code);
    upsertShopToken(shop, accessToken);

    // initialize settings if not present
    const existingSettings = getShopSettings(shop);
    if (!existingSettings) {
      upsertShopSettings({
        shop,
        wab2cWebhookUrl: config.wab2cWebhookUrl,
        wab2cWebhookUrls: {},
        authHeaderName: config.wab2cAuthHeaderName,
        authHeaderValue: config.wab2cAuthHeaderValue,
        whatsmarkDomain: config.whatsmarkDomain,
        whatsmarkTenant: config.whatsmarkTenant,
        whatsmarkApiToken: config.whatsmarkApiToken,
        whatsmarkTemplates: config.whatsmarkTemplates,
        whatsmarkFields: {},
        simpleMessages: {},
        enabledTopics: config.webhookTopics
      });
    }

    await registerAllWebhooks(shop, accessToken);

    const installedAt = getShopInstalledAt(shop)!;
    const session = signSession(shop, installedAt);
    res.redirect(`/settings?shop=${encodeURIComponent(shop)}&session=${encodeURIComponent(session)}`);
  } catch (e: any) {
    res.status(500).send(`Install failed: ${e?.message || String(e)}`);
  }
});

// Settings UI
app.get("/settings", (req, res) => {
  const shop = normalizeShop(String(req.query.shop || ""));
  const session = String(req.query.session || "");
  if (!requireSession(shop, session)) {
    // If opened from Shopify Admin with signed query parameters, convert it into our session URL.
    if (isValidShopifySignedQuery(req)) {
      const signed = trySignSessionFromShop(shop);
      if (signed) {
        return res.redirect(`/settings?shop=${encodeURIComponent(shop)}&session=${encodeURIComponent(signed)}`);
      }
    }
    return res.status(401).send("Unauthorized");
  }

  const settings = getShopSettings(shop);
  if (!settings) return res.status(404).send("Settings not found (install app again)");

  const enabled = new Set(settings.enabledTopics);
  const topics = config.webhookTopics;

  res.type("html").send(`
    <html>
      <head>
        <meta charset="utf-8">
        <title>WAB2C Settings</title>
      </head>
      <body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; max-width: 900px;">
        <div style="display:flex; gap:16px; align-items:center;">
          <img src="/assets/wab2c-logo.png" alt="WAB2C" style="height:48px; width:auto;" onerror="this.style.display='none'">
          <div>
            <h2 style="margin:0;">WAB2C WhatsApp Notifications</h2>
            <div style="color:#555;">Shop: <b>${shop}</b></div>
          </div>
        </div>

        <hr style="margin: 20px 0;">

        <form method="post" action="/settings?shop=${encodeURIComponent(shop)}&session=${encodeURIComponent(session)}">
          <div style="margin-bottom: 12px;">
            <label style="display:block; font-weight:600; margin-bottom:6px;">WAB2C Webhook URL</label>
            <input name="wab2c_webhook_url" value="${escapeHtml(settings.wab2cWebhookUrl)}" style="width:100%; padding:10px;" placeholder="https://your-wab2c-domain.com/webhook/xxxx" />
            <div style="color:#666; font-size: 13px; margin-top: 6px;">
              Optional: set per-event webhook URL below (recommended if you create multiple webhooks in WAB2C dashboard).
            </div>
          </div>

          <div style="margin-bottom: 12px;">
            <div style="font-weight:600; margin-bottom:6px;">WAB2C Webhook URL (per Shopify topic)</div>
            <div style="display:grid; grid-template-columns: 220px 1fr; gap:10px; align-items:center;">
              ${topics
                .map((t) => {
                  const key = `wab2c_${t.replaceAll("/", "_")}`;
                  const v = settings.wab2cWebhookUrls?.[t] || "";
                  return `
                    <div style="color:#444;">${escapeHtml(t)}</div>
                    <input name="${escapeHtml(key)}" value="${escapeHtml(v)}" style="width:100%; padding:10px;" placeholder="Paste WAB2C webhook URL for this event" />
                  `;
                })
                .join("")}
            </div>
          </div>

          <div style="display:flex; gap:12px; margin-bottom: 12px;">
            <div style="flex: 1;">
              <label style="display:block; font-weight:600; margin-bottom:6px;">Auth Header Name (optional)</label>
              <input name="auth_header_name" value="${escapeHtml(settings.authHeaderName)}" style="width:100%; padding:10px;" placeholder="Authorization" />
            </div>
            <div style="flex: 2;">
              <label style="display:block; font-weight:600; margin-bottom:6px;">Auth Header Value (optional)</label>
              <input name="auth_header_value" value="${escapeHtml(settings.authHeaderValue)}" style="width:100%; padding:10px;" placeholder="Bearer xxxx" />
            </div>
          </div>

          <hr style="margin: 18px 0;">
          <div style="margin-bottom: 10px; font-weight: 700;">WhatsMark SaaS API (optional)</div>
          <div style="color:#666; font-size: 13px; margin-bottom: 10px;">
            If you fill these, the app will call WhatsMark SaaS directly on Shopify events. Domain should be WITHOUT https://
          </div>

          <div style="display:flex; gap:12px; margin-bottom: 12px;">
            <div style="flex: 2;">
              <label style="display:block; font-weight:600; margin-bottom:6px;">WhatsMark Domain</label>
              <input name="whatsmark_domain" value="${escapeHtml(settings.whatsmarkDomain)}" style="width:100%; padding:10px;" placeholder="app.wab2c.com" />
            </div>
            <div style="flex: 1;">
              <label style="display:block; font-weight:600; margin-bottom:6px;">Tenant</label>
              <input name="whatsmark_tenant" value="${escapeHtml(settings.whatsmarkTenant)}" style="width:100%; padding:10px;" placeholder="tenantx" />
            </div>
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display:block; font-weight:600; margin-bottom:6px;">API Token</label>
            <input name="whatsmark_api_token" value="${escapeHtml(settings.whatsmarkApiToken)}" style="width:100%; padding:10px;" placeholder="your token" />
          </div>

          <div style="margin-bottom: 12px;">
            <div style="font-weight:600; margin-bottom:6px;">Template mapping (by Shopify topic)</div>
            <div style="display:grid; grid-template-columns: 220px 1fr; gap:10px; align-items:center;">
              ${topics
                .map((t) => {
                  const key = `tmpl_${t.replaceAll("/", "_")}`;
                  const v = settings.whatsmarkTemplates?.[t] || "";
                  return `
                    <div style="color:#444;">${escapeHtml(t)}</div>
                    <input name="${escapeHtml(key)}" value="${escapeHtml(v)}" style="width:100%; padding:10px;" placeholder="template_name (leave empty to send simple text)" />
                  `;
                })
                .join("")}
            </div>
            <div style="color:#666; font-size: 13px; margin-top: 8px;">
              WhatsMark endpoint requires multipart fields: <code>phone_number</code>, <code>template_name</code>, <code>template_language</code>. We use <b>en</b> by default.
            </div>
          </div>

          <div style="margin-bottom: 12px;">
            <div style="font-weight:600; margin-bottom:6px;">Dynamic placeholders (per topic)</div>
            <div style="color:#666; font-size: 13px; margin-bottom: 10px;">
              Use placeholders like <code>{{order_name}}</code>, <code>{{order_number}}</code>, <code>{{total_price}}</code>, <code>{{currency}}</code>, <code>{{customer_first_name}}</code>.
            </div>
            <div style="display:grid; grid-template-columns: 220px 1fr; gap:10px; align-items:start;">
              ${topics
                .map((t) => {
                  const msgKey = `msg_${t.replaceAll("/", "_")}`;
                  const msgVal = settings.simpleMessages?.[t] || "";
                  const f1Key = `f1_${t.replaceAll("/", "_")}`;
                  const f1Val = settings.whatsmarkFields?.[t]?.field_1 || "";
                  const f2Key = `f2_${t.replaceAll("/", "_")}`;
                  const f2Val = settings.whatsmarkFields?.[t]?.field_2 || "";
                  const f3Key = `f3_${t.replaceAll("/", "_")}`;
                  const f3Val = settings.whatsmarkFields?.[t]?.field_3 || "";
                  return `
                    <div style="color:#444; padding-top: 8px;">${escapeHtml(t)}</div>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                      <textarea name="${escapeHtml(msgKey)}" style="width:100%; padding:10px; min-height:64px;" placeholder="Simple message text (used when template name is empty)">${escapeHtml(msgVal)}</textarea>
                      <div style="display:grid; grid-template-columns: 100px 1fr; gap:8px; align-items:center;">
                        <div style="color:#666;">field_1</div><input name="${escapeHtml(f1Key)}" value="${escapeHtml(f1Val)}" style="width:100%; padding:10px;" placeholder="{{order_name}}" />
                        <div style="color:#666;">field_2</div><input name="${escapeHtml(f2Key)}" value="${escapeHtml(f2Val)}" style="width:100%; padding:10px;" placeholder="{{total_price}}" />
                        <div style="color:#666;">field_3</div><input name="${escapeHtml(f3Key)}" value="${escapeHtml(f3Val)}" style="width:100%; padding:10px;" placeholder="{{currency}}" />
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </div>

          <div style="margin-bottom: 12px;">
            <div style="font-weight:600; margin-bottom:6px;">Enabled Topics</div>
            ${topics
              .map(
                (t) => `
                  <label style="display:block; margin: 6px 0;">
                    <input type="checkbox" name="enabled_topic" value="${escapeHtml(t)}" ${enabled.has(t) ? "checked" : ""} />
                    ${escapeHtml(t)}
                  </label>
                `
              )
              .join("")}
          </div>

          <button type="submit" style="padding:10px 14px; font-weight:600;">Save</button>
        </form>

        <hr style="margin: 20px 0;">
        <div style="color:#666; font-size: 13px;">
          Webhooks are received at <code>${config.appUrl}/webhooks</code> and forwarded to your WAB2C webhook.
        </div>
      </body>
    </html>
  `);
});

// Parse form body for settings save
app.post("/settings", express.urlencoded({ extended: false }), (req, res) => {
  const shop = normalizeShop(String(req.query.shop || ""));
  const session = String(req.query.session || "");
  if (!requireSession(shop, session)) {
    // Allow saving if Shopify signed query is present (embedded app navigation).
    if (!isValidShopifySignedQuery(req)) return res.status(401).send("Unauthorized");
  }

  const wab2cWebhookUrl = String(req.body.wab2c_webhook_url || "").trim();
  const authHeaderName = String(req.body.auth_header_name || "").trim();
  const authHeaderValue = String(req.body.auth_header_value || "").trim();
  const whatsmarkDomain = String(req.body.whatsmark_domain || "").trim();
  const whatsmarkTenant = String(req.body.whatsmark_tenant || "").trim();
  const whatsmarkApiToken = String(req.body.whatsmark_api_token || "").trim();

  const wab2cWebhookUrls: Record<string, string> = {};
  for (const t of config.webhookTopics) {
    const key = `wab2c_${t.replaceAll("/", "_")}`;
    const v = String((req.body as any)[key] || "").trim();
    if (v) wab2cWebhookUrls[t] = v;
  }

  const whatsmarkTemplates: Record<string, string> = {};
  const whatsmarkFields: Record<string, Record<string, string>> = {};
  const simpleMessages: Record<string, string> = {};
  for (const t of config.webhookTopics) {
    const key = `tmpl_${t.replaceAll("/", "_")}`;
    const v = String((req.body as any)[key] || "").trim();
    if (v) whatsmarkTemplates[t] = v;

    const msgKey = `msg_${t.replaceAll("/", "_")}`;
    const msgVal = String((req.body as any)[msgKey] || "").trim();
    if (msgVal) simpleMessages[t] = msgVal;

    const f1 = String((req.body as any)[`f1_${t.replaceAll("/", "_")}`] || "").trim();
    const f2 = String((req.body as any)[`f2_${t.replaceAll("/", "_")}`] || "").trim();
    const f3 = String((req.body as any)[`f3_${t.replaceAll("/", "_")}`] || "").trim();
    const fields: Record<string, string> = {};
    if (f1) fields.field_1 = f1;
    if (f2) fields.field_2 = f2;
    if (f3) fields.field_3 = f3;
    if (Object.keys(fields).length) whatsmarkFields[t] = fields;
  }

  const enabledTopicRaw = req.body.enabled_topic;
  const enabledTopics = Array.isArray(enabledTopicRaw)
    ? enabledTopicRaw.map((s: any) => String(s))
    : enabledTopicRaw
      ? [String(enabledTopicRaw)]
      : [];

  if (!wab2cWebhookUrl) return res.status(400).send("WAB2C webhook URL is required");

  upsertShopSettings({
    shop,
    wab2cWebhookUrl,
    wab2cWebhookUrls,
    authHeaderName,
    authHeaderValue,
    whatsmarkDomain,
    whatsmarkTenant,
    whatsmarkApiToken,
    whatsmarkTemplates,
    whatsmarkFields,
    simpleMessages,
    enabledTopics
  });

  const nextSession = requireSession(shop, session) ? session : (trySignSessionFromShop(shop) || session);
  res.redirect(`/settings?shop=${encodeURIComponent(shop)}&session=${encodeURIComponent(nextSession)}`);
});

// Webhook receiver needs RAW body for HMAC verification.
app.post(
  "/webhooks",
  express.raw({ type: "*/*", limit: "2mb" }),
  async (req, res) => {
    const topic = String(req.header("X-Shopify-Topic") || "");
    let shop: string;
    try {
      shop = normalizeShop(String(req.header("X-Shopify-Shop-Domain") || ""));
    } catch {
      return res.status(400).send("Invalid shop");
    }

    const rawBody = Buffer.isBuffer(req.body) ? (req.body as Buffer) : Buffer.from("");
    if (!verifyShopifyWebhook(req, rawBody)) return res.status(401).send("Invalid webhook HMAC");

    const settings = getShopSettings(shop);
    if (!settings) return res.status(404).send("Shop not installed");
    if (settings.enabledTopics.length > 0 && !settings.enabledTopics.includes(topic)) {
      return res.status(200).send("Ignored");
    }

    let payload: any = null;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      payload = rawBody.toString("utf8");
    }

    try {
      // 1) If WhatsMark configured, send message via WhatsMark API
      const customerPhone =
        (payload?.customer?.phone as string | undefined) ||
        (payload?.shipping_address?.phone as string | undefined) ||
        (payload?.billing_address?.phone as string | undefined) ||
        "";

      const phone = String(customerPhone || "").replace(/\s+/g, "");
      const hasWhatsMark = Boolean(settings.whatsmarkDomain && settings.whatsmarkTenant && settings.whatsmarkApiToken);

      if (hasWhatsMark && phone) {
        const ctx = buildShopifyContext(payload || {});
        const templateName = settings.whatsmarkTemplates?.[topic] || "";
        if (templateName) {
          const mappedFields: Record<string, string> = {};
          const conf = settings.whatsmarkFields?.[topic] || {};
          for (const [k, v] of Object.entries(conf)) {
            mappedFields[k] = renderPlaceholders(String(v), ctx);
          }
          await sendTemplateMessage({
            domain: settings.whatsmarkDomain,
            tenant: settings.whatsmarkTenant,
            apiToken: settings.whatsmarkApiToken,
            phoneNumber: phone,
            templateName,
            templateLanguage: "en",
            fields: mappedFields
          });
        } else {
          const msgTpl = settings.simpleMessages?.[topic] || "";
          const orderLabel = payload?.name || payload?.order_number || payload?.id || "";
          await sendSimpleMessage({
            domain: settings.whatsmarkDomain,
            tenant: settings.whatsmarkTenant,
            apiToken: settings.whatsmarkApiToken,
            phoneNumber: phone,
            messageBody: msgTpl ? renderPlaceholders(msgTpl, ctx) : `Shopify update (${topic}) for order ${orderLabel}`
          });
        }
      }

      // 2) Also forward raw event to WAB2C webhook (keeps current flow working)
      await forwardToWab2c({ shop, topic, payload, settings });
      res.status(200).send("OK");
    } catch (e: any) {
      // Return 200 so Shopify doesn't keep retrying forever; log for investigation.
      // If you want retries, change this to 500.
      console.error("Forward error", { shop, topic, err: e?.message || String(e) });
      res.status(200).send("Forward failed");
    }
  }
);

// Serve logo if present in src/
app.use("/assets", express.static(srcDir));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(config.port, () => {
  console.log(`WAB2C Shopify app listening on :${config.port}`);
  console.log(`APP_URL = ${config.appUrl}`);
});

function escapeHtml(s: string): string {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


