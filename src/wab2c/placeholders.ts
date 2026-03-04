type AnyObj = Record<string, any>;

export function buildShopifyContext(payload: AnyObj): Record<string, string> {
  const customer = payload?.customer || {};
  const shipping = payload?.shipping_address || {};
  const billing = payload?.billing_address || {};

  const ctx: Record<string, string> = {
    order_id: String(payload?.id ?? ""),
    order_name: String(payload?.name ?? ""),
    order_number: String(payload?.order_number ?? ""),
    financial_status: String(payload?.financial_status ?? ""),
    fulfillment_status: String(payload?.fulfillment_status ?? ""),
    currency: String(payload?.currency ?? ""),
    total_price: String(payload?.total_price ?? ""),
    subtotal_price: String(payload?.subtotal_price ?? ""),
    total_discounts: String(payload?.total_discounts ?? ""),
    created_at: String(payload?.created_at ?? ""),

    customer_first_name: String(customer?.first_name ?? ""),
    customer_last_name: String(customer?.last_name ?? ""),
    customer_name: String([customer?.first_name, customer?.last_name].filter(Boolean).join(" ")),
    customer_email: String(customer?.email ?? ""),
    customer_phone: String(customer?.phone ?? ""),

    shipping_phone: String(shipping?.phone ?? ""),
    billing_phone: String(billing?.phone ?? ""),
    shipping_address1: String(shipping?.address1 ?? ""),
    shipping_city: String(shipping?.city ?? ""),
    shipping_country: String(shipping?.country ?? "")
  };

  // remove undefined/empty-ish values? keep as "" so templates don't show "undefined"
  for (const k of Object.keys(ctx)) {
    if (ctx[k] === "undefined" || ctx[k] === "null") ctx[k] = "";
  }
  return ctx;
}

export function renderPlaceholders(template: string, ctx: Record<string, string>): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const v = ctx[String(key)] ?? "";
    return String(v);
  });
}

