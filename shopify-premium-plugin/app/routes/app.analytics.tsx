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
  DataTable,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "~/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalSent, sentToday, sentWeek, sentMonth, failedTotal, deliveredTotal] =
    await Promise.all([
      prisma.messageLog.count({ where: { shopDomain } }),
      prisma.messageLog.count({ where: { shopDomain, sentAt: { gte: today } } }),
      prisma.messageLog.count({ where: { shopDomain, sentAt: { gte: weekAgo } } }),
      prisma.messageLog.count({ where: { shopDomain, sentAt: { gte: monthStart } } }),
      prisma.messageLog.count({ where: { shopDomain, status: "FAILED" } }),
      prisma.messageLog.count({
        where: { shopDomain, status: { in: ["SENT", "DELIVERED"] } },
      }),
    ]);

  const successRate = totalSent > 0 ? Math.round((deliveredTotal / totalSent) * 100) : 0;

  // Abandoned cart stats
  const [totalCarts, recoveredCarts, cartMessagesSent] = await Promise.all([
    prisma.abandonedCheckout.count({ where: { shopDomain } }),
    prisma.abandonedCheckout.count({ where: { shopDomain, recovered: true } }),
    prisma.abandonedCheckout.count({ where: { shopDomain, messageSent: true } }),
  ]);
  const cartRecoveryRate =
    cartMessagesSent > 0 ? Math.round((recoveredCarts / cartMessagesSent) * 100) : 0;

  // By event type breakdown
  const byEventRaw = await prisma.messageLog.groupBy({
    by: ["eventType"],
    where: { shopDomain },
    _count: true,
  });
  const byEvent = byEventRaw.map((r) => ({
    eventType: r.eventType.replace(/_/g, " "),
    count: r._count,
  }));

  // Recent messages
  const recentMessages = await prisma.messageLog.findMany({
    where: { shopDomain },
    orderBy: { sentAt: "desc" },
    take: 20,
    select: {
      eventType: true,
      recipientPhone: true,
      status: true,
      sentAt: true,
      orderNumber: true,
    },
  });

  return json({
    totalSent,
    sentToday,
    sentWeek,
    sentMonth,
    failedTotal,
    successRate,
    totalCarts,
    recoveredCarts,
    cartRecoveryRate,
    byEvent,
    recentMessages,
  });
};

export default function AnalyticsPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <Page title="Analytics" backAction={{ url: "/app" }}>
      <BlockStack gap="500">
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <StatCard title="Today" value={data.sentToday} />
          <StatCard title="This Week" value={data.sentWeek} />
          <StatCard title="This Month" value={data.sentMonth} />
          <StatCard title="Success Rate" value={`${data.successRate}%`} />
        </InlineGrid>

        <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Total Messages</Text>
              <Text as="p" variant="headingLg">{data.totalSent}</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {data.failedTotal} failed
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Cart Recovery</Text>
              <Text as="p" variant="headingLg">{data.cartRecoveryRate}%</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {data.recoveredCarts} / {data.totalCarts} carts recovered
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">By Event Type</Text>
            <DataTable
              columnContentTypes={["text", "numeric"]}
              headings={["Event", "Messages"]}
              rows={data.byEvent.map((e: any) => [e.eventType, e.count])}
            />
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Recent Messages</Text>
            <DataTable
              columnContentTypes={["text", "text", "text", "text", "text"]}
              headings={["Event", "Phone", "Order", "Status", "Time"]}
              rows={data.recentMessages.map((m: any) => [
                m.eventType.replace(/_/g, " "),
                m.recipientPhone,
                m.orderNumber || "-",
                m.status,
                new Date(m.sentAt).toLocaleString(),
              ])}
            />
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">{title}</Text>
        <Text as="p" variant="headingLg">{value}</Text>
      </BlockStack>
    </Card>
  );
}
