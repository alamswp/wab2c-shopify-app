import pg from "pg";
import { config } from "../config.js";
import type { ShopSettings } from "./types.js";

const { Pool } = pg;

function shouldUseSsl(connectionString: string): boolean {
  const cs = connectionString.toLowerCase();
  if (cs.includes("sslmode=disable")) return false;
  if (cs.includes("localhost") || cs.includes("127.0.0.1")) return false;
  return true;
}

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl && shouldUseSsl(config.databaseUrl) ? { rejectUnauthorized: false } : undefined
});

let initPromise: Promise<void> | null = null;

export async function initPostgres(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shops (
        shop TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        installed_at TIMESTAMPTZ NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS oauth_states (
        shop TEXT NOT NULL,
        state TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (shop, state)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS shop_settings (
        shop TEXT PRIMARY KEY,
        wab2c_webhook_url TEXT NOT NULL,
        wab2c_webhook_urls_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        auth_header_name TEXT NOT NULL,
        auth_header_value TEXT NOT NULL,
        whatsmark_domain TEXT NOT NULL,
        whatsmark_tenant TEXT NOT NULL,
        whatsmark_api_token TEXT NOT NULL,
        whatsmark_templates_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        whatsmark_fields_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        simple_messages_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        enabled_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);
  })();
  return initPromise;
}

export async function upsertShopToken(shop: string, accessToken: string) {
  await initPostgres();
  await pool.query(
    `
    INSERT INTO shops (shop, access_token, installed_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (shop) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      installed_at = EXCLUDED.installed_at
    `,
    [shop, accessToken]
  );
}

export async function getShopToken(shop: string): Promise<string | null> {
  await initPostgres();
  const res = await pool.query(`SELECT access_token FROM shops WHERE shop = $1`, [shop]);
  return res.rows[0]?.access_token ?? null;
}

export async function getShopInstalledAt(shop: string): Promise<string | null> {
  await initPostgres();
  const res = await pool.query(`SELECT installed_at FROM shops WHERE shop = $1`, [shop]);
  return res.rows[0]?.installed_at ? new Date(res.rows[0].installed_at).toISOString() : null;
}

export async function saveOAuthState(shop: string, state: string) {
  await initPostgres();
  await pool.query(`INSERT INTO oauth_states (shop, state, created_at) VALUES ($1, $2, NOW())`, [shop, state]);
}

export async function consumeOAuthState(shop: string, state: string): Promise<boolean> {
  await initPostgres();
  const res = await pool.query(`DELETE FROM oauth_states WHERE shop = $1 AND state = $2 RETURNING 1`, [shop, state]);
  return (res.rowCount || 0) > 0;
}

export async function upsertShopSettings(settings: Omit<ShopSettings, "updatedAt">) {
  await initPostgres();
  await pool.query(
    `
    INSERT INTO shop_settings (
      shop,
      wab2c_webhook_url,
      wab2c_webhook_urls_json,
      auth_header_name,
      auth_header_value,
      whatsmark_domain,
      whatsmark_tenant,
      whatsmark_api_token,
      whatsmark_templates_json,
      whatsmark_fields_json,
      simple_messages_json,
      enabled_topics,
      updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW()
    )
    ON CONFLICT (shop) DO UPDATE SET
      wab2c_webhook_url = EXCLUDED.wab2c_webhook_url,
      wab2c_webhook_urls_json = EXCLUDED.wab2c_webhook_urls_json,
      auth_header_name = EXCLUDED.auth_header_name,
      auth_header_value = EXCLUDED.auth_header_value,
      whatsmark_domain = EXCLUDED.whatsmark_domain,
      whatsmark_tenant = EXCLUDED.whatsmark_tenant,
      whatsmark_api_token = EXCLUDED.whatsmark_api_token,
      whatsmark_templates_json = EXCLUDED.whatsmark_templates_json,
      whatsmark_fields_json = EXCLUDED.whatsmark_fields_json,
      simple_messages_json = EXCLUDED.simple_messages_json,
      enabled_topics = EXCLUDED.enabled_topics,
      updated_at = EXCLUDED.updated_at
    `,
    [
      settings.shop,
      settings.wab2cWebhookUrl,
      settings.wab2cWebhookUrls || {},
      settings.authHeaderName,
      settings.authHeaderValue,
      settings.whatsmarkDomain,
      settings.whatsmarkTenant,
      settings.whatsmarkApiToken,
      settings.whatsmarkTemplates || {},
      settings.whatsmarkFields || {},
      settings.simpleMessages || {},
      settings.enabledTopics || []
    ]
  );
}

export async function getShopSettings(shop: string): Promise<ShopSettings | null> {
  await initPostgres();
  const res = await pool.query(
    `
    SELECT
      shop,
      wab2c_webhook_url,
      wab2c_webhook_urls_json,
      auth_header_name,
      auth_header_value,
      whatsmark_domain,
      whatsmark_tenant,
      whatsmark_api_token,
      whatsmark_templates_json,
      whatsmark_fields_json,
      simple_messages_json,
      enabled_topics,
      updated_at
    FROM shop_settings
    WHERE shop = $1
    `,
    [shop]
  );
  const row = res.rows[0];
  if (!row) return null;

  return {
    shop: row.shop,
    wab2cWebhookUrl: row.wab2c_webhook_url,
    wab2cWebhookUrls: row.wab2c_webhook_urls_json || {},
    authHeaderName: row.auth_header_name,
    authHeaderValue: row.auth_header_value,
    whatsmarkDomain: row.whatsmark_domain,
    whatsmarkTenant: row.whatsmark_tenant,
    whatsmarkApiToken: row.whatsmark_api_token,
    whatsmarkTemplates: row.whatsmark_templates_json || {},
    whatsmarkFields: row.whatsmark_fields_json || {},
    simpleMessages: row.simple_messages_json || {},
    enabledTopics: row.enabled_topics || [],
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
  };
}

