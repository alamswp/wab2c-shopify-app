import type { EventType } from "@prisma/client";
import prisma from "~/db.server";

export const DEFAULT_TEMPLATES: Record<string, { name: string; body: string }> = {
  ORDER_CREATED: {
    name: "Order Confirmation",
    body: "Hi {{customer_name}}, thank you for your order #{{order_number}}! Total: {{total}} {{currency}}. We'll notify you when it ships.",
  },
  ORDER_PAID: {
    name: "Payment Received",
    body: "Payment confirmed for order #{{order_number}}. Amount: {{total}} {{currency}}. Thank you, {{customer_name}}!",
  },
  ORDER_FULFILLED: {
    name: "Order Shipped",
    body: "Great news {{customer_name}}! Your order #{{order_number}} has been shipped. {{tracking_info}}",
  },
  ORDER_CANCELLED: {
    name: "Order Cancelled",
    body: "Hi {{customer_name}}, your order #{{order_number}} has been cancelled. If you have questions, please contact us.",
  },
  REFUND_CREATED: {
    name: "Refund Processed",
    body: "Hi {{customer_name}}, a refund has been processed for order #{{order_number}}. Amount: {{refund_amount}} {{currency}}.",
  },
  ABANDONED_CART: {
    name: "Cart Recovery",
    body: "Hi {{customer_name}}, you left items in your cart! Complete your purchase: {{recovery_url}}",
  },
  COD_CONFIRMATION: {
    name: "COD Confirmation",
    body: "Hi {{customer_name}}, please confirm your COD order #{{order_number}} ({{total}} {{currency}}). Reply CONFIRM to proceed or CANCEL to cancel.",
  },
};

export async function ensureDefaultTemplates(shopDomain: string) {
  for (const [eventType, { name, body }] of Object.entries(DEFAULT_TEMPLATES)) {
    await prisma.messageTemplate.upsert({
      where: { shopDomain_eventType: { shopDomain, eventType: eventType as EventType } },
      create: { shopDomain, eventType: eventType as EventType, name, body },
      update: {},
    });
  }
}

export async function getTemplate(shopDomain: string, eventType: EventType) {
  return prisma.messageTemplate.findUnique({
    where: { shopDomain_eventType: { shopDomain, eventType } },
  });
}

export async function getAllTemplates(shopDomain: string) {
  return prisma.messageTemplate.findMany({ where: { shopDomain } });
}

export async function updateTemplate(
  shopDomain: string,
  eventType: EventType,
  data: { name?: string; body?: string; isActive?: boolean }
) {
  return prisma.messageTemplate.update({
    where: { shopDomain_eventType: { shopDomain, eventType } },
    data,
  });
}

export function renderTemplate(template: string, ctx: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    return ctx[String(key)] ?? "";
  });
}

export function buildOrderContext(payload: any): Record<string, string> {
  const customer = payload?.customer || {};
  const shipping = payload?.shipping_address || {};
  const billing = payload?.billing_address || {};
  const fulfillments = payload?.fulfillments || [];
  const lastFulfillment = fulfillments[fulfillments.length - 1] || {};

  return {
    order_id: String(payload?.id ?? ""),
    order_name: String(payload?.name ?? ""),
    order_number: String(payload?.order_number ?? ""),
    financial_status: String(payload?.financial_status ?? ""),
    fulfillment_status: String(payload?.fulfillment_status ?? ""),
    currency: String(payload?.currency ?? ""),
    total: String(payload?.total_price ?? ""),
    subtotal: String(payload?.subtotal_price ?? ""),
    total_discounts: String(payload?.total_discounts ?? ""),
    created_at: String(payload?.created_at ?? ""),
    customer_first_name: String(customer?.first_name ?? ""),
    customer_last_name: String(customer?.last_name ?? ""),
    customer_name: [customer?.first_name, customer?.last_name].filter(Boolean).join(" "),
    customer_email: String(customer?.email ?? ""),
    customer_phone: String(customer?.phone ?? shipping?.phone ?? billing?.phone ?? ""),
    shipping_address: String(shipping?.address1 ?? ""),
    shipping_city: String(shipping?.city ?? ""),
    shipping_country: String(shipping?.country ?? ""),
    tracking_number: String(lastFulfillment?.tracking_number ?? ""),
    tracking_url: String(lastFulfillment?.tracking_url ?? ""),
    tracking_info: lastFulfillment?.tracking_number
      ? `Tracking: ${lastFulfillment.tracking_number}${lastFulfillment.tracking_url ? ` - ${lastFulfillment.tracking_url}` : ""}`
      : "",
    refund_amount: String(payload?.refund?.transactions?.[0]?.amount ?? payload?.total_price ?? ""),
    payment_method: String(payload?.gateway ?? payload?.payment_gateway_names?.[0] ?? ""),
  };
}
