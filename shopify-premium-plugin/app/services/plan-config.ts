export const PLAN_LIMITS = {
  FREE: { messages: 50, price: 0, name: "Free" },
  STARTER: { messages: 1250, price: 4.99, name: "Starter" },
  GROWTH: { messages: 2500, price: 9.99, name: "Growth" },
  PROFESSIONAL: { messages: 4250, price: 14.99, name: "Professional" },
} as const;

export type PlanTierKey = keyof typeof PLAN_LIMITS;
