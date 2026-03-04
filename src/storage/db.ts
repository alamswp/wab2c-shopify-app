import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "../config.js";

function ensureDirForFile(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDirForFile(config.sqlitePath);
export const db = new Database(config.sqlitePath);

db.exec(`
  CREATE TABLE IF NOT EXISTS shops (
    shop TEXT PRIMARY KEY,
    access_token TEXT NOT NULL,
    installed_at TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS oauth_states (
    shop TEXT NOT NULL,
    state TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (shop, state)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS shop_settings (
    shop TEXT PRIMARY KEY,
    wab2c_webhook_url TEXT NOT NULL,
    wab2c_webhook_urls_json TEXT NOT NULL,
    auth_header_name TEXT NOT NULL,
    auth_header_value TEXT NOT NULL,
    whatsmark_domain TEXT NOT NULL,
    whatsmark_tenant TEXT NOT NULL,
    whatsmark_api_token TEXT NOT NULL,
    whatsmark_templates_json TEXT NOT NULL,
    whatsmark_fields_json TEXT NOT NULL,
    simple_messages_json TEXT NOT NULL,
    enabled_topics TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Lightweight migrations for existing installs
try {
  db.exec(`ALTER TABLE shop_settings ADD COLUMN wab2c_webhook_urls_json TEXT NOT NULL DEFAULT '{}'`);
} catch {}
try {
  db.exec(`ALTER TABLE shop_settings ADD COLUMN whatsmark_fields_json TEXT NOT NULL DEFAULT '{}'`);
} catch {}
try {
  db.exec(`ALTER TABLE shop_settings ADD COLUMN simple_messages_json TEXT NOT NULL DEFAULT '{}'`);
} catch {}

export function upsertShopToken(shop: string, accessToken: string) {
  const stmt = db.prepare(`
    INSERT INTO shops (shop, access_token, installed_at)
    VALUES (?, ?, ?)
    ON CONFLICT(shop) DO UPDATE SET
      access_token = excluded.access_token,
      installed_at = excluded.installed_at
  `);
  stmt.run(shop, accessToken, new Date().toISOString());
}

export function getShopToken(shop: string): string | null {
  const row = db.prepare(`SELECT access_token FROM shops WHERE shop = ?`).get(shop) as { access_token: string } | undefined;
  return row?.access_token || null;
}

export function getShopInstalledAt(shop: string): string | null {
  const row = db.prepare(`SELECT installed_at FROM shops WHERE shop = ?`).get(shop) as { installed_at: string } | undefined;
  return row?.installed_at || null;
}

export function saveOAuthState(shop: string, state: string) {
  db.prepare(`INSERT INTO oauth_states (shop, state, created_at) VALUES (?, ?, ?)`).run(shop, state, new Date().toISOString());
}

export function consumeOAuthState(shop: string, state: string): boolean {
  const row = db.prepare(`SELECT 1 FROM oauth_states WHERE shop = ? AND state = ?`).get(shop, state);
  db.prepare(`DELETE FROM oauth_states WHERE shop = ? AND state = ?`).run(shop, state);
  return Boolean(row);
}

export type ShopSettings = {
  shop: string;
  wab2cWebhookUrl: string;
  wab2cWebhookUrls: Record<string, string>;
  authHeaderName: string;
  authHeaderValue: string;
  whatsmarkDomain: string;
  whatsmarkTenant: string;
  whatsmarkApiToken: string;
  whatsmarkTemplates: Record<string, string>;
  whatsmarkFields: Record<string, Record<string, string>>;
  simpleMessages: Record<string, string>;
  enabledTopics: string[];
  updatedAt: string;
};

export function upsertShopSettings(settings: Omit<ShopSettings, "updatedAt">) {
  db.prepare(
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
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(shop) DO UPDATE SET
      wab2c_webhook_url = excluded.wab2c_webhook_url,
      wab2c_webhook_urls_json = excluded.wab2c_webhook_urls_json,
      auth_header_name = excluded.auth_header_name,
      auth_header_value = excluded.auth_header_value,
      whatsmark_domain = excluded.whatsmark_domain,
      whatsmark_tenant = excluded.whatsmark_tenant,
      whatsmark_api_token = excluded.whatsmark_api_token,
      whatsmark_templates_json = excluded.whatsmark_templates_json,
      whatsmark_fields_json = excluded.whatsmark_fields_json,
      simple_messages_json = excluded.simple_messages_json,
      enabled_topics = excluded.enabled_topics,
      updated_at = excluded.updated_at
  `
  ).run(
    settings.shop,
    settings.wab2cWebhookUrl,
    JSON.stringify(settings.wab2cWebhookUrls || {}),
    settings.authHeaderName,
    settings.authHeaderValue,
    settings.whatsmarkDomain,
    settings.whatsmarkTenant,
    settings.whatsmarkApiToken,
    JSON.stringify(settings.whatsmarkTemplates || {}),
    JSON.stringify(settings.whatsmarkFields || {}),
    JSON.stringify(settings.simpleMessages || {}),
    JSON.stringify(settings.enabledTopics),
    new Date().toISOString()
  );
}

export function getShopSettings(shop: string): ShopSettings | null {
  const row = db
    .prepare(
      `SELECT
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
      WHERE shop = ?`
    )
    .get(shop) as
    | {
        shop: string;
        wab2c_webhook_url: string;
        wab2c_webhook_urls_json: string;
        auth_header_name: string;
        auth_header_value: string;
        whatsmark_domain: string;
        whatsmark_tenant: string;
        whatsmark_api_token: string;
        whatsmark_templates_json: string;
        whatsmark_fields_json: string;
        simple_messages_json: string;
        enabled_topics: string;
        updated_at: string;
      }
    | undefined;

  if (!row) return null;
  let wab2cWebhookUrls: Record<string, string> = {};
  try {
    wab2cWebhookUrls = JSON.parse(row.wab2c_webhook_urls_json || "{}") as Record<string, string>;
  } catch {
    wab2cWebhookUrls = {};
  }
  let enabledTopics: string[] = [];
  try {
    enabledTopics = JSON.parse(row.enabled_topics) as string[];
  } catch {
    enabledTopics = [];
  }
  let whatsmarkTemplates: Record<string, string> = {};
  try {
    whatsmarkTemplates = JSON.parse(row.whatsmark_templates_json || "{}") as Record<string, string>;
  } catch {
    whatsmarkTemplates = {};
  }
  let whatsmarkFields: Record<string, Record<string, string>> = {};
  try {
    whatsmarkFields = JSON.parse(row.whatsmark_fields_json || "{}") as Record<string, Record<string, string>>;
  } catch {
    whatsmarkFields = {};
  }
  let simpleMessages: Record<string, string> = {};
  try {
    simpleMessages = JSON.parse(row.simple_messages_json || "{}") as Record<string, string>;
  } catch {
    simpleMessages = {};
  }
  return {
    shop: row.shop,
    wab2cWebhookUrl: row.wab2c_webhook_url,
    wab2cWebhookUrls,
    authHeaderName: row.auth_header_name,
    authHeaderValue: row.auth_header_value,
    whatsmarkDomain: row.whatsmark_domain,
    whatsmarkTenant: row.whatsmark_tenant,
    whatsmarkApiToken: row.whatsmark_api_token,
    whatsmarkTemplates,
    whatsmarkFields,
    simpleMessages,
    enabledTopics,
    updatedAt: row.updated_at
  };
}


