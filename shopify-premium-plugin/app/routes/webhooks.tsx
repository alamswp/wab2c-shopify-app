import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { handleOrderEvent } from "~/services/message-sender.server";
import { trackCheckout, markCheckoutRecovered } from "~/services/abandoned-cart.server";
import prisma from "~/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`[WAB2C] Webhook received: ${topic} from ${shop}`);

  switch (topic) {
    case "ORDERS_CREATE": {
      await handleOrderEvent(shop, "ORDER_CREATED", payload);

      // COD confirmation
      const gateway = (payload as any)?.gateway || (payload as any)?.payment_gateway_names?.[0] || "";
      const isCod = gateway.toLowerCase().includes("cod") || gateway.toLowerCase().includes("cash");
      if (isCod) {
        const settings = await prisma.shopSetting.findUnique({ where: { shopDomain: shop } });
        if (settings?.codConfirmEnabled) {
          await handleOrderEvent(shop, "COD_CONFIRMATION", payload);
        }
      }
      break;
    }

    case "ORDERS_PAID":
      await handleOrderEvent(shop, "ORDER_PAID", payload);
      break;

    case "ORDERS_FULFILLED":
      await handleOrderEvent(shop, "ORDER_FULFILLED", payload);
      break;

    case "ORDERS_CANCELLED":
      await handleOrderEvent(shop, "ORDER_CANCELLED", payload);
      break;

    case "REFUNDS_CREATE":
      await handleOrderEvent(shop, "REFUND_CREATED", payload);
      break;

    case "ORDERS_UPDATED":
      break;

    case "CHECKOUTS_CREATE":
    case "CHECKOUTS_UPDATE":
      await trackCheckout(shop, payload);
      break;

    case "APP_UNINSTALLED":
      // Clean up shop data (GDPR compliance)
      console.log(`[WAB2C] App uninstalled from ${shop}`);
      break;

    case "CUSTOMERS_DATA_REQUEST":
      // GDPR: return customer data
      console.log(`[WAB2C] Customer data request for ${shop}`);
      break;

    case "CUSTOMERS_REDACT":
      // GDPR: delete customer data
      console.log(`[WAB2C] Customer data redact for ${shop}`);
      break;

    case "SHOP_REDACT":
      // GDPR: delete shop data
      console.log(`[WAB2C] Shop data redact for ${shop}`);
      await prisma.messageLog.deleteMany({ where: { shopDomain: shop } });
      await prisma.abandonedCheckout.deleteMany({ where: { shopDomain: shop } });
      await prisma.messageTemplate.deleteMany({ where: { shopDomain: shop } });
      await prisma.whatsAppConnection.deleteMany({ where: { shopDomain: shop } });
      await prisma.shopSetting.deleteMany({ where: { shopDomain: shop } });
      await prisma.shop.deleteMany({ where: { shopDomain: shop } });
      break;

    default:
      console.log(`[WAB2C] Unhandled webhook topic: ${topic}`);
  }

  return new Response("OK", { status: 200 });
};
