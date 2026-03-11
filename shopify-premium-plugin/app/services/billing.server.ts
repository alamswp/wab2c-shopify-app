import type { PlanTier } from "@prisma/client";
import prisma from "~/db.server";
import { PLAN_LIMITS } from "./plan-config";
export { PLAN_LIMITS } from "./plan-config";

export async function getShopPlan(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { shopDomain } });
  if (!shop) return { tier: "FREE" as PlanTier, ...PLAN_LIMITS.FREE, used: 0 };

  const limit = PLAN_LIMITS[shop.planTier];
  return {
    tier: shop.planTier,
    ...limit,
    used: shop.messageCount,
    remaining: Math.max(0, limit.messages - shop.messageCount),
  };
}

export async function canSendMessage(shopDomain: string): Promise<boolean> {
  const plan = await getShopPlan(shopDomain);
  return plan.used < plan.messages;
}

export async function incrementMessageCount(shopDomain: string) {
  await prisma.shop.update({
    where: { shopDomain },
    data: { messageCount: { increment: 1 } },
  });
}

export async function resetBillingCycleIfNeeded(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { shopDomain } });
  if (!shop) return;

  const daysSinceCycleStart =
    (Date.now() - shop.billingCycleStart.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceCycleStart >= 30) {
    await prisma.shop.update({
      where: { shopDomain },
      data: { messageCount: 0, billingCycleStart: new Date() },
    });
  }
}

export async function upgradePlan(
  shopDomain: string,
  tier: PlanTier,
  chargeId?: string
) {
  await prisma.shop.update({
    where: { shopDomain },
    data: { planTier: tier, chargeId: chargeId ?? null },
  });
}

export function createBillingConfig(tier: PlanTier) {
  const plan = PLAN_LIMITS[tier];
  if (tier === "FREE") return null;

  return {
    name: `WAB2C ${plan.name}`,
    amount: plan.price,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS" as const,
    trialDays: 3,
  };
}
