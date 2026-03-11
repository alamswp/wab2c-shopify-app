import prisma from "~/db.server";
import { sendMessage } from "./whatsapp.server";
import { getTemplate, renderTemplate } from "./templates.server";
import { canSendMessage, incrementMessageCount } from "./billing.server";

export async function trackCheckout(shopDomain: string, payload: any) {
  const settings = await prisma.shopSetting.findUnique({ where: { shopDomain } });
  if (!settings?.abandonedCartEnabled) return;

  const checkoutId = String(payload?.id ?? "");
  if (!checkoutId) return;

  const phone =
    payload?.shipping_address?.phone ||
    payload?.billing_address?.phone ||
    payload?.customer?.phone ||
    "";
  const name = [payload?.customer?.first_name, payload?.customer?.last_name]
    .filter(Boolean)
    .join(" ");

  const delayMinutes = settings.abandonedCartDelay || 60;
  const sendAfter = new Date(Date.now() + delayMinutes * 60 * 1000);

  await prisma.abandonedCheckout.upsert({
    where: { shopDomain_checkoutId: { shopDomain, checkoutId } },
    create: {
      shopDomain,
      checkoutId,
      checkoutToken: payload?.token ?? null,
      customerPhone: phone || null,
      customerEmail: payload?.email ?? null,
      customerName: name || null,
      cartTotal: String(payload?.total_price ?? ""),
      currency: String(payload?.currency ?? ""),
      recoveryUrl: payload?.abandoned_checkout_url ?? null,
      sendAfter,
    },
    update: {
      customerPhone: phone || undefined,
      cartTotal: String(payload?.total_price ?? ""),
      recoveryUrl: payload?.abandoned_checkout_url ?? undefined,
    },
  });
}

export async function markCheckoutRecovered(shopDomain: string, checkoutId: string) {
  await prisma.abandonedCheckout.updateMany({
    where: { shopDomain, checkoutId, recovered: false },
    data: { recovered: true },
  });
}

export async function processAbandonedCarts() {
  const now = new Date();
  const pendingCarts = await prisma.abandonedCheckout.findMany({
    where: {
      messageSent: false,
      recovered: false,
      sendAfter: { lte: now },
      customerPhone: { not: null },
    },
    take: 50,
  });

  for (const cart of pendingCarts) {
    if (!cart.customerPhone) continue;

    const allowed = await canSendMessage(cart.shopDomain);
    if (!allowed) continue;

    const template = await getTemplate(cart.shopDomain, "ABANDONED_CART");
    if (!template?.isActive) continue;

    const ctx: Record<string, string> = {
      customer_name: cart.customerName || "",
      customer_email: cart.customerEmail || "",
      customer_phone: cart.customerPhone || "",
      cart_total: cart.cartTotal || "",
      currency: cart.currency || "",
      recovery_url: cart.recoveryUrl || "",
    };

    const body = renderTemplate(template.body, ctx);
    const result = await sendMessage(cart.shopDomain, cart.customerPhone, body);

    await incrementMessageCount(cart.shopDomain);

    await prisma.abandonedCheckout.update({
      where: { id: cart.id },
      data: { messageSent: true, sentAt: new Date() },
    });

    await prisma.messageLog.create({
      data: {
        shopDomain: cart.shopDomain,
        eventType: "ABANDONED_CART",
        recipientPhone: cart.customerPhone,
        messageBody: body,
        status: result.ok ? "SENT" : "FAILED",
        errorMessage: result.error ?? null,
      },
    });
  }
}

// Call this periodically (e.g. every 5 minutes via setInterval on server start)
let cartInterval: ReturnType<typeof setInterval> | null = null;

export function startAbandonedCartProcessor() {
  if (cartInterval) return;
  cartInterval = setInterval(() => {
    processAbandonedCarts().catch((e) =>
      console.error("[WAB2C] Abandoned cart processor error", e)
    );
  }, 5 * 60 * 1000);
  console.log("[WAB2C] Abandoned cart processor started (every 5 min)");
}
