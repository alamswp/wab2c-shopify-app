-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'STARTER', 'GROWTH', 'PROFESSIONAL');
CREATE TYPE "ConnectionType" AS ENUM ('WAB2C_API', 'QR_DIRECT');
CREATE TYPE "EventType" AS ENUM ('ORDER_CREATED', 'ORDER_PAID', 'ORDER_FULFILLED', 'ORDER_CANCELLED', 'REFUND_CREATED', 'ABANDONED_CART', 'COD_CONFIRMATION');
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

-- CreateTable Session (required by Shopify session storage)
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable Shop
CREATE TABLE IF NOT EXISTS "Shop" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "planTier" "PlanTier" NOT NULL DEFAULT 'FREE',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "billingCycleStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chargeId" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Shop_shopDomain_key" ON "Shop"("shopDomain");

-- CreateTable ShopSetting
CREATE TABLE IF NOT EXISTS "ShopSetting" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "orderCreatedEnabled" BOOLEAN NOT NULL DEFAULT true,
    "orderPaidEnabled" BOOLEAN NOT NULL DEFAULT true,
    "orderFulfilledEnabled" BOOLEAN NOT NULL DEFAULT true,
    "orderCancelledEnabled" BOOLEAN NOT NULL DEFAULT true,
    "refundCreatedEnabled" BOOLEAN NOT NULL DEFAULT true,
    "abandonedCartEnabled" BOOLEAN NOT NULL DEFAULT true,
    "codConfirmEnabled" BOOLEAN NOT NULL DEFAULT true,
    "abandonedCartDelay" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ShopSetting_shopDomain_key" ON "ShopSetting"("shopDomain");

-- CreateTable WhatsAppConnection
CREATE TABLE IF NOT EXISTS "WhatsAppConnection" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "connectionType" "ConnectionType" NOT NULL,
    "wab2cDomain" TEXT,
    "wab2cTenant" TEXT,
    "wab2cApiToken" TEXT,
    "qrSessionData" TEXT,
    "phoneNumber" TEXT,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "lastConnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsAppConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppConnection_shopDomain_key" ON "WhatsAppConnection"("shopDomain");

-- CreateTable MessageTemplate
CREATE TABLE IF NOT EXISTS "MessageTemplate" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MessageTemplate_shopDomain_eventType_key" ON "MessageTemplate"("shopDomain", "eventType");

-- CreateTable MessageLog
CREATE TABLE IF NOT EXISTS "MessageLog" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "messageBody" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "errorMessage" TEXT,
    "orderId" TEXT,
    "orderNumber" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MessageLog_shopDomain_sentAt_idx" ON "MessageLog"("shopDomain", "sentAt");
CREATE INDEX IF NOT EXISTS "MessageLog_shopDomain_eventType_idx" ON "MessageLog"("shopDomain", "eventType");

-- CreateTable AbandonedCheckout
CREATE TABLE IF NOT EXISTS "AbandonedCheckout" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "checkoutId" TEXT NOT NULL,
    "checkoutToken" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "customerName" TEXT,
    "cartTotal" TEXT,
    "currency" TEXT,
    "recoveryUrl" TEXT,
    "messageSent" BOOLEAN NOT NULL DEFAULT false,
    "recovered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sendAfter" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    CONSTRAINT "AbandonedCheckout_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AbandonedCheckout_shopDomain_checkoutId_key" ON "AbandonedCheckout"("shopDomain", "checkoutId");
CREATE INDEX IF NOT EXISTS "AbandonedCheckout_messageSent_sendAfter_idx" ON "AbandonedCheckout"("messageSent", "sendAfter");

-- AddForeignKeys
ALTER TABLE "ShopSetting" ADD CONSTRAINT "ShopSetting_shopDomain_fkey" FOREIGN KEY ("shopDomain") REFERENCES "Shop"("shopDomain") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsAppConnection" ADD CONSTRAINT "WhatsAppConnection_shopDomain_fkey" FOREIGN KEY ("shopDomain") REFERENCES "Shop"("shopDomain") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_shopDomain_fkey" FOREIGN KEY ("shopDomain") REFERENCES "Shop"("shopDomain") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_shopDomain_fkey" FOREIGN KEY ("shopDomain") REFERENCES "Shop"("shopDomain") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AbandonedCheckout" ADD CONSTRAINT "AbandonedCheckout_shopDomain_fkey" FOREIGN KEY ("shopDomain") REFERENCES "Shop"("shopDomain") ON DELETE CASCADE ON UPDATE CASCADE;
