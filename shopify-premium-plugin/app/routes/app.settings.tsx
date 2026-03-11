import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  Checkbox,
  Button,
  Banner,
  TextField,
  Divider,
  InlineStack,
  Badge,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import prisma from "~/db.server";
import { getShopPlan, upgradePlan } from "~/services/billing.server";
import { PLAN_LIMITS } from "~/services/plan-config";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const settings = await prisma.shopSetting.findUnique({ where: { shopDomain } });
  const plan = await getShopPlan(shopDomain);

  return json({ shopDomain, settings, plan });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save_settings") {
    await prisma.shopSetting.upsert({
      where: { shopDomain },
      create: {
        shopDomain,
        orderCreatedEnabled: formData.get("orderCreatedEnabled") === "true",
        orderPaidEnabled: formData.get("orderPaidEnabled") === "true",
        orderFulfilledEnabled: formData.get("orderFulfilledEnabled") === "true",
        orderCancelledEnabled: formData.get("orderCancelledEnabled") === "true",
        refundCreatedEnabled: formData.get("refundCreatedEnabled") === "true",
        abandonedCartEnabled: formData.get("abandonedCartEnabled") === "true",
        codConfirmEnabled: formData.get("codConfirmEnabled") === "true",
        abandonedCartDelay: Number(formData.get("abandonedCartDelay")) || 60,
      },
      update: {
        orderCreatedEnabled: formData.get("orderCreatedEnabled") === "true",
        orderPaidEnabled: formData.get("orderPaidEnabled") === "true",
        orderFulfilledEnabled: formData.get("orderFulfilledEnabled") === "true",
        orderCancelledEnabled: formData.get("orderCancelledEnabled") === "true",
        refundCreatedEnabled: formData.get("refundCreatedEnabled") === "true",
        abandonedCartEnabled: formData.get("abandonedCartEnabled") === "true",
        codConfirmEnabled: formData.get("codConfirmEnabled") === "true",
        abandonedCartDelay: Number(formData.get("abandonedCartDelay")) || 60,
      },
    });
    return json({ success: "Settings saved!" });
  }

  if (intent === "upgrade") {
    const tier = String(formData.get("tier")) as any;
    await upgradePlan(shopDomain, tier);
    return json({ success: `Upgraded to ${PLAN_LIMITS[tier as keyof typeof PLAN_LIMITS]?.name || tier}` });
  }

  return json({});
};

export default function SettingsPage() {
  const { settings, plan } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const [s, setS] = useState({
    orderCreatedEnabled: settings?.orderCreatedEnabled ?? true,
    orderPaidEnabled: settings?.orderPaidEnabled ?? true,
    orderFulfilledEnabled: settings?.orderFulfilledEnabled ?? true,
    orderCancelledEnabled: settings?.orderCancelledEnabled ?? true,
    refundCreatedEnabled: settings?.refundCreatedEnabled ?? true,
    abandonedCartEnabled: settings?.abandonedCartEnabled ?? true,
    codConfirmEnabled: settings?.codConfirmEnabled ?? true,
    abandonedCartDelay: String(settings?.abandonedCartDelay ?? 60),
  });

  return (
    <Page title="Settings" backAction={{ url: "/app" }}>
      <BlockStack gap="500">
        {(actionData as any)?.success && (
          <Banner title={(actionData as any).success} tone="success" />
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Event Notifications</Text>
                <Divider />
                <Checkbox label="Order Created" checked={s.orderCreatedEnabled} onChange={(v) => setS({ ...s, orderCreatedEnabled: v })} />
                <Checkbox label="Order Paid" checked={s.orderPaidEnabled} onChange={(v) => setS({ ...s, orderPaidEnabled: v })} />
                <Checkbox label="Order Fulfilled" checked={s.orderFulfilledEnabled} onChange={(v) => setS({ ...s, orderFulfilledEnabled: v })} />
                <Checkbox label="Order Cancelled" checked={s.orderCancelledEnabled} onChange={(v) => setS({ ...s, orderCancelledEnabled: v })} />
                <Checkbox label="Refund Created" checked={s.refundCreatedEnabled} onChange={(v) => setS({ ...s, refundCreatedEnabled: v })} />
                <Divider />
                <Checkbox label="Abandoned Cart Recovery" checked={s.abandonedCartEnabled} onChange={(v) => setS({ ...s, abandonedCartEnabled: v })} />
                <TextField
                  label="Cart Recovery Delay (minutes)"
                  value={s.abandonedCartDelay}
                  onChange={(v) => setS({ ...s, abandonedCartDelay: v })}
                  type="number"
                  autoComplete="off"
                />
                <Divider />
                <Checkbox label="COD Confirmation Polls" checked={s.codConfirmEnabled} onChange={(v) => setS({ ...s, codConfirmEnabled: v })} />
                <Button
                  variant="primary"
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("intent", "save_settings");
                    for (const [k, v] of Object.entries(s)) fd.set(k, String(v));
                    submit(fd, { method: "post" });
                  }}
                >
                  Save Settings
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Current Plan</Text>
                <Badge tone="info">{PLAN_LIMITS[plan.tier as keyof typeof PLAN_LIMITS]?.name}</Badge>
                <Text as="p" variant="bodySm">
                  {plan.used} / {plan.messages} messages this cycle
                </Text>
                <Divider />
                <Text as="h3" variant="headingSm">Upgrade</Text>
                {(["STARTER", "GROWTH", "PROFESSIONAL"] as const).map((tier) => (
                  <InlineStack key={tier} gap="200" align="space-between" blockAlign="center">
                    <Text as="span" variant="bodySm">
                      {PLAN_LIMITS[tier].name} — ${PLAN_LIMITS[tier].price}/mo ({PLAN_LIMITS[tier].messages} msgs)
                    </Text>
                    <Button
                      size="slim"
                      disabled={plan.tier === tier}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("intent", "upgrade");
                        fd.set("tier", tier);
                        submit(fd, { method: "post" });
                      }}
                    >
                      {plan.tier === tier ? "Current" : "Select"}
                    </Button>
                  </InlineStack>
                ))}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
