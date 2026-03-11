import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  TextField,
  Button,
  Badge,
  Tabs,
  Banner,
  InlineStack,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import prisma from "~/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const connection = await prisma.whatsAppConnection.findUnique({
    where: { shopDomain },
  });

  return json({
    shopDomain,
    connection: connection
      ? {
          connectionType: connection.connectionType,
          wab2cDomain: connection.wab2cDomain || "",
          wab2cTenant: connection.wab2cTenant || "",
          wab2cApiToken: connection.wab2cApiToken || "",
          isConnected: connection.isConnected,
          phoneNumber: connection.phoneNumber || "",
        }
      : null,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save_wab2c") {
    const domain = String(formData.get("wab2cDomain") || "").trim();
    const tenant = String(formData.get("wab2cTenant") || "").trim();
    const token = String(formData.get("wab2cApiToken") || "").trim();

    if (!domain || !tenant || !token) {
      return json({ error: "All WAB2C fields are required" }, { status: 400 });
    }

    await prisma.whatsAppConnection.upsert({
      where: { shopDomain },
      create: {
        shopDomain,
        connectionType: "WAB2C_API",
        wab2cDomain: domain,
        wab2cTenant: tenant,
        wab2cApiToken: token,
        isConnected: true,
        lastConnectedAt: new Date(),
      },
      update: {
        connectionType: "WAB2C_API",
        wab2cDomain: domain,
        wab2cTenant: tenant,
        wab2cApiToken: token,
        isConnected: true,
        lastConnectedAt: new Date(),
      },
    });

    return json({ success: "WAB2C API connected successfully!" });
  }

  if (intent === "generate_qr") {
    try {
      const { getQrCode } = await import("~/services/whatsapp-qr.server");
      const qr = await getQrCode(shopDomain);
      if (!qr) return json({ error: "Failed to generate QR code. Try again." });
      const QRCode = await import("qrcode");
      const qrDataUrl = await QRCode.toDataURL(qr);
      return json({ qrDataUrl });
    } catch (e: any) {
      return json({ error: `QR generation failed: ${e?.message}` });
    }
  }

  if (intent === "disconnect") {
    await prisma.whatsAppConnection.updateMany({
      where: { shopDomain },
      data: { isConnected: false },
    });
    try {
      const { disconnectQr } = await import("~/services/whatsapp-qr.server");
      await disconnectQr(shopDomain);
    } catch {}
    return json({ success: "Disconnected" });
  }

  return json({});
};

export default function ConnectionPage() {
  const { connection } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const [selectedTab, setSelectedTab] = useState(0);
  const [wab2cDomain, setWab2cDomain] = useState(connection?.wab2cDomain || "");
  const [wab2cTenant, setWab2cTenant] = useState(connection?.wab2cTenant || "");
  const [wab2cApiToken, setWab2cApiToken] = useState(connection?.wab2cApiToken || "");

  const handleTabChange = useCallback((i: number) => setSelectedTab(i), []);

  const tabs = [
    { id: "wab2c", content: "WAB2C API", panelID: "wab2c-panel" },
    { id: "qr", content: "WhatsApp Direct (QR)", panelID: "qr-panel" },
  ];

  return (
    <Page title="WhatsApp Connection" backAction={{ url: "/app" }}>
      <BlockStack gap="500">
        {connection?.isConnected && (
          <Banner title="WhatsApp Connected" tone="success">
            <p>
              Connected via{" "}
              {connection.connectionType === "WAB2C_API"
                ? "WAB2C API"
                : `WhatsApp Direct (${connection.phoneNumber})`}
            </p>
          </Banner>
        )}

        {(actionData as any)?.success && (
          <Banner title={(actionData as any).success} tone="success" />
        )}
        {(actionData as any)?.error && (
          <Banner title={(actionData as any).error} tone="critical" />
        )}

        <Card>
          <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
            {selectedTab === 0 ? (
              <BlockStack gap="400">
                <Text as="p" variant="bodyMd">
                  Connect using your WAB2C / WhatsMark SaaS API credentials.
                  Get these from your WAB2C dashboard → API Management.
                </Text>
                <TextField
                  label="WAB2C Domain"
                  value={wab2cDomain}
                  onChange={setWab2cDomain}
                  placeholder="app.wab2c.com"
                  helpText="Without https://"
                  autoComplete="off"
                />
                <TextField
                  label="Tenant"
                  value={wab2cTenant}
                  onChange={setWab2cTenant}
                  placeholder="your-tenant"
                  autoComplete="off"
                />
                <TextField
                  label="API Token"
                  value={wab2cApiToken}
                  onChange={setWab2cApiToken}
                  placeholder="your-api-token"
                  type="password"
                  autoComplete="off"
                />
                <InlineStack gap="300">
                  <Button
                    variant="primary"
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("intent", "save_wab2c");
                      fd.set("wab2cDomain", wab2cDomain);
                      fd.set("wab2cTenant", wab2cTenant);
                      fd.set("wab2cApiToken", wab2cApiToken);
                      submit(fd, { method: "post" });
                    }}
                  >
                    Connect WAB2C
                  </Button>
                  {connection?.isConnected && (
                    <Button
                      tone="critical"
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("intent", "disconnect");
                        submit(fd, { method: "post" });
                      }}
                    >
                      Disconnect
                    </Button>
                  )}
                </InlineStack>
              </BlockStack>
            ) : (
              <BlockStack gap="400">
                <Text as="p" variant="bodyMd">
                  Scan the QR code below with your WhatsApp phone to connect directly.
                  Messages will be sent from your phone number.
                </Text>

                {(actionData as any)?.qrDataUrl ? (
                  <div style={{ textAlign: "center" }}>
                    <img
                      src={(actionData as any).qrDataUrl}
                      alt="WhatsApp QR Code"
                      style={{ width: 280, height: 280 }}
                    />
                    <Text as="p" variant="bodySm" tone="subdued">
                      Open WhatsApp → Settings → Linked Devices → Link a Device → Scan this QR
                    </Text>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("intent", "generate_qr");
                      submit(fd, { method: "post" });
                    }}
                  >
                    Generate QR Code
                  </Button>
                )}

                {connection?.isConnected &&
                  connection.connectionType === "QR_DIRECT" && (
                    <InlineStack gap="300" align="center">
                      <Badge tone="success">Connected: {connection.phoneNumber}</Badge>
                      <Button
                        tone="critical"
                        onClick={() => {
                          const fd = new FormData();
                          fd.set("intent", "disconnect");
                          submit(fd, { method: "post" });
                        }}
                      >
                        Disconnect
                      </Button>
                    </InlineStack>
                  )}
              </BlockStack>
            )}
          </Tabs>
        </Card>
      </BlockStack>
    </Page>
  );
}
