import type { EventType } from "@prisma/client";
import prisma from "~/db.server";
import { sendMessage } from "./whatsapp.server";
import { getTemplate, renderTemplate, buildOrderContext } from "./templates.server";
import { canSendMessage, incrementMessageCount } from "./billing.server";

export async function handleOrderEvent(
  shopDomain: string,
  eventType: EventType,
  payload: any
) {
  const settings = await prisma.shopSetting.findUnique({ where: { shopDomain } });

  // Check if this event type is enabled
  const enabledMap: Record<string, boolean> = {
    ORDER_CREATED: settings?.orderCreatedEnabled ?? true,
    ORDER_PAID: settings?.orderPaidEnabled ?? true,
    ORDER_FULFILLED: settings?.orderFulfilledEnabled ?? true,
    ORDER_CANCELLED: settings?.orderCancelledEnabled ?? true,
    REFUND_CREATED: settings?.refundCreatedEnabled ?? true,
  };
  if (!enabledMap[eventType]) return;

  const template = await getTemplate(shopDomain, eventType);
  if (!template?.isActive) return;

  const ctx = buildOrderContext(payload);
  const phone =
    ctx.customer_phone?.replace(/\s+/g, "") || "";
  if (!phone) {
    await logMessage(shopDomain, eventType, "", "No phone number", "FAILED", payload);
    return;
  }

  // Check billing limits
  const allowed = await canSendMessage(shopDomain);
  if (!allowed) {
    await logMessage(shopDomain, eventType, phone, "Message limit reached", "FAILED", payload);
    return;
  }

  const messageBody = renderTemplate(template.body, ctx);

  const result = await sendMessage(shopDomain, phone, messageBody);

  await incrementMessageCount(shopDomain);
  await logMessage(
    shopDomain,
    eventType,
    phone,
    messageBody,
    result.ok ? "SENT" : "FAILED",
    payload,
    result.error
  );
}

async function logMessage(
  shopDomain: string,
  eventType: EventType,
  phone: string,
  body: string,
  status: "QUEUED" | "SENT" | "DELIVERED" | "FAILED",
  payload?: any,
  error?: string
) {
  try {
    await prisma.messageLog.create({
      data: {
        shopDomain,
        eventType,
        recipientPhone: phone,
        messageBody: body,
        status,
        errorMessage: error ?? null,
        orderId: String(payload?.id ?? ""),
        orderNumber: String(payload?.order_number ?? payload?.name ?? ""),
      },
    });
  } catch (e) {
    console.error("[WAB2C] Failed to log message", e);
  }
}
