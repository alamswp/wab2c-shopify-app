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

