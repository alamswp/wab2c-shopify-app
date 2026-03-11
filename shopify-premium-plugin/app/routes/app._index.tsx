import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  Badge,
  Banner,
  Box,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "~/db.server";
import { ensureDefaultTemplates } from "~/services/templates.server";
import { getShopPlan } from "~/services/billing.server";
import { PLAN_LIMITS } from "~/services/plan-config";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Ensure shop + settings + templates exist
  await prisma.shop.upsert({
    where: { shopDomain },
    create: { shopDomain },
    update: {},
  });
  await prisma.shopSetting.upsert({
    where: { shopDomain },
    create: { shopDomain },
    update: {},
  });
  await ensureDefaultTemplates(shopDomain);

  const connection = await prisma.whatsAppConnection.findUnique({
    where: { shopDomain },
  });

  const plan = await getShopPlan(shopDomain);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const messagesToday = await prisma.messageLog.count({
    where: { shopDomain, sentAt: { gte: today } },
  });

  const messagesThisMonth = await prisma.messageLog.count({
    where: {
      shopDomain,
      sentAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) },
    },
  });

  const failedToday = await prisma.messageLog.count({
    where: { shopDomain, status: "FAILED", sentAt: { gte: today } },
  });

  return json({
    shopDomain,
    isConnected: connection?.isConnected ?? false,
    connectionType: connection?.connectionType ?? null,
    plan,
    messagesToday,
    messagesThisMonth,
    failedToday,
  });
};

export default function Dashboard() {
  const {
    shopDomain,
    isConnected,
    connectionType,
    plan,
    messagesToday,
    messagesThisMonth,
    failedToday,
  } = useLoaderData<typeof loader>();

  return (
    <Page title="WAB2C Dashboard">
      <BlockStack gap="500">
        {!isConnected && (
          <Banner
            title="WhatsApp not connected"
            tone="warning"
            action={{ content: "Connect Now", url: "/app/connection" }}
          >
            <p>Connect your WhatsApp to start sending automated messages.</p>
          </Banner>
        )}

        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Status</Text>
              <Badge tone={isConnected ? "success" : "critical"}>
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
              {connectionType && (
                <Text as="p" variant="bodySm" tone="subdued">
                  via {connectionType === "WAB2C_API" ? "WAB2C API" : "WhatsApp Direct"}
                </Text>
              )}
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Plan</Text>
              <Text as="p" variant="headingLg">{PLAN_LIMITS[plan.tier as keyof typeof PLAN_LIMITS].name}</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {plan.used} / {plan.messages} messages used
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Today</Text>
              <Text as="p" variant="headingLg">{messagesToday}</Text>
              <Text as="p" variant="bodySm" tone="subdued">messages sent</Text>
              {failedToday > 0 && (
                <Badge tone="critical">{failedToday} failed</Badge>
              )}
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">This Month</Text>
              <Text as="p" variant="headingLg">{messagesThisMonth}</Text>
              <Text as="p" variant="bodySm" tone="subdued">messages sent</Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Quick Actions</Text>
                <InlineGrid columns={3} gap="300">
                  <Box padding="400" borderRadius="200" background="bg-surface-secondary">
                    <BlockStack gap="100">
                      <Text as="h3" variant="headingSm">Connection</Text>
                      <Text as="p" variant="bodySm">Connect WAB2C API or scan WhatsApp QR code</Text>
                    </BlockStack>
                  </Box>
                  <Box padding="400" borderRadius="200" background="bg-surface-secondary">
                    <BlockStack gap="100">
                      <Text as="h3" variant="headingSm">Templates</Text>
                      <Text as="p" variant="bodySm">Customize messages for each order event</Text>
                    </BlockStack>
                  </Box>
                  <Box padding="400" borderRadius="200" background="bg-surface-secondary">
                    <BlockStack gap="100">
                      <Text as="h3" variant="headingSm">Analytics</Text>
                      <Text as="p" variant="bodySm">Track delivery rates and engagement</Text>
                    </BlockStack>
                  </Box>
                </InlineGrid>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
