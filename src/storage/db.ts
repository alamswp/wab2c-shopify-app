import { config } from "../config.js";
import type { ShopSettings } from "./types.js";
import * as sqlite from "./sqlite.js";
import * as pgStore from "./postgres.js";

export type { ShopSettings } from "./types.js";

const usePostgres = Boolean(config.databaseUrl);

export async function upsertShopToken(shop: string, accessToken: string) {
  if (usePostgres) return await pgStore.upsertShopToken(shop, accessToken);
  return sqlite.upsertShopToken(shop, accessToken);
}

export async function getShopToken(shop: string): Promise<string | null> {
  if (usePostgres) return await pgStore.getShopToken(shop);
  return sqlite.getShopToken(shop);
}

export async function getShopInstalledAt(shop: string): Promise<string | null> {
  if (usePostgres) return await pgStore.getShopInstalledAt(shop);
  return sqlite.getShopInstalledAt(shop);
}

export async function saveOAuthState(shop: string, state: string) {
  if (usePostgres) return await pgStore.saveOAuthState(shop, state);
  return sqlite.saveOAuthState(shop, state);
}

export async function consumeOAuthState(shop: string, state: string): Promise<boolean> {
  if (usePostgres) return await pgStore.consumeOAuthState(shop, state);
  return sqlite.consumeOAuthState(shop, state);
}

export async function upsertShopSettings(settings: Omit<ShopSettings, "updatedAt">) {
  if (usePostgres) return await pgStore.upsertShopSettings(settings);
  return sqlite.upsertShopSettings(settings);
}

export async function getShopSettings(shop: string): Promise<ShopSettings | null> {
  if (usePostgres) return await pgStore.getShopSettings(shop);
  return sqlite.getShopSettings(shop);
}


