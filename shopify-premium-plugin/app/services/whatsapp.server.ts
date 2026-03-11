import prisma from "~/db.server";

export async function sendViaWab2c(args: {
  domain: string;
  tenant: string;
  apiToken: string;
  phoneNumber: string;
  messageBody: string;
}): Promise<{ ok: boolean; error?: string }> {
  const base = `https://${args.domain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  const url = `${base}/api/v1/${encodeURIComponent(args.tenant)}/messages/send`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.apiToken}`,
      },
      body: JSON.stringify({
        phone_number: args.phoneNumber,
        message_body: args.messageBody,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `${res.status} ${txt}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function sendViaWab2cTemplate(args: {
  domain: string;
  tenant: string;
  apiToken: string;
  phoneNumber: string;
  templateName: string;
  templateLanguage: string;
  fields?: Record<string, string>;
}): Promise<{ ok: boolean; error?: string }> {
  const base = `https://${args.domain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  const url = `${base}/api/v1/${encodeURIComponent(args.tenant)}/messages/template`;

  const form = new FormData();
  form.set("phone_number", args.phoneNumber);
  form.set("template_name", args.templateName);
  form.set("template_language", args.templateLanguage);
  for (const [k, v] of Object.entries(args.fields || {})) {
    if (v !== undefined && v !== null) form.set(k, String(v));
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${args.apiToken}` },
      body: form,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `${res.status} ${txt}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function getConnectionForShop(shopDomain: string) {
  return prisma.whatsAppConnection.findUnique({
    where: { shopDomain },
  });
}

export async function sendMessage(
  shopDomain: string,
  phoneNumber: string,
  messageBody: string
): Promise<{ ok: boolean; error?: string }> {
  const conn = await getConnectionForShop(shopDomain);
  if (!conn || !conn.isConnected) {
    return { ok: false, error: "WhatsApp not connected" };
  }

  if (conn.connectionType === "WAB2C_API") {
    if (!conn.wab2cDomain || !conn.wab2cTenant || !conn.wab2cApiToken) {
      return { ok: false, error: "WAB2C credentials not configured" };
    }
    return sendViaWab2c({
      domain: conn.wab2cDomain,
      tenant: conn.wab2cTenant,
      apiToken: conn.wab2cApiToken,
      phoneNumber,
      messageBody,
    });
  }

  if (conn.connectionType === "QR_DIRECT") {
    return sendViaQrDirect(shopDomain, phoneNumber, messageBody);
  }

  return { ok: false, error: "Unknown connection type" };
}

// QR Direct (Baileys) - placeholder; full implementation in whatsapp-qr.server.ts
export async function sendViaQrDirect(
  _shopDomain: string,
  _phoneNumber: string,
  _messageBody: string
): Promise<{ ok: boolean; error?: string }> {
  // Baileys integration will be loaded dynamically to avoid crashes if unavailable
  try {
    const { sendBaileysMessage } = await import("./whatsapp-qr.server");
    return sendBaileysMessage(_shopDomain, _phoneNumber, _messageBody);
  } catch (e: any) {
    return { ok: false, error: `QR Direct not available: ${e?.message}` };
  }
}
