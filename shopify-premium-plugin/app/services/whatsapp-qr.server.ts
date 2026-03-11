import prisma from "~/db.server";

// In-memory map of active Baileys sockets per shop
const activeSockets = new Map<string, any>();

async function loadBaileys() {
  try {
    return await (eval('import("baileys")') as Promise<any>);
  } catch {
    return null;
  }
}

export async function getQrCode(shopDomain: string): Promise<string | null> {
  const baileys = await loadBaileys();
  if (!baileys) return null;

  const makeWASocket = baileys.default;
  const DisconnectReason = baileys.DisconnectReason;
  const Browsers = baileys.Browsers;

  return new Promise(async (resolve) => {
    let qrReceived = false;

    const { state, saveCreds } = await createAuthState(shopDomain);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers?.ubuntu?.("WAB2C") ?? ["WAB2C", "Chrome", "1.0"],
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update: any) => {
      const { qr, connection, lastDisconnect } = update;

      if (qr && !qrReceived) {
        qrReceived = true;
        resolve(qr);
      }

      if (connection === "open") {
        activeSockets.set(shopDomain, sock);
        const phoneNumber = sock.user?.id?.split(":")[0] || sock.user?.id || "";
        await prisma.whatsAppConnection.upsert({
          where: { shopDomain },
          create: {
            shopDomain,
            connectionType: "QR_DIRECT",
            isConnected: true,
            phoneNumber,
            lastConnectedAt: new Date(),
          },
          update: {
            isConnected: true,
            phoneNumber,
            lastConnectedAt: new Date(),
          },
        });
      }

      if (connection === "close") {
        activeSockets.delete(shopDomain);
        const reason = (lastDisconnect?.error as any)?.output?.statusCode;
        if (reason !== DisconnectReason?.loggedOut) {
          setTimeout(() => reconnect(shopDomain), 5000);
        } else {
          await prisma.whatsAppConnection.updateMany({
            where: { shopDomain },
            data: { isConnected: false, qrSessionData: null },
          });
        }
      }
    });

    setTimeout(() => {
      if (!qrReceived) resolve(null);
    }, 30000);
  });
}

export async function disconnectQr(shopDomain: string) {
  const sock = activeSockets.get(shopDomain);
  if (sock) {
    try {
      await sock.logout();
    } catch {
      sock.end(undefined);
    }
    activeSockets.delete(shopDomain);
  }
  await prisma.whatsAppConnection.updateMany({
    where: { shopDomain },
    data: { isConnected: false, qrSessionData: null },
  });
}

export async function sendBaileysMessage(
  shopDomain: string,
  phoneNumber: string,
  messageBody: string
): Promise<{ ok: boolean; error?: string }> {
  const sock = activeSockets.get(shopDomain);
  if (!sock) {
    return { ok: false, error: "WhatsApp not connected (QR session expired)" };
  }

  const jid = phoneNumber.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

  try {
    await sock.sendMessage(jid, { text: messageBody });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function reconnect(shopDomain: string) {
  console.log(`[WAB2C] Reconnecting ${shopDomain}...`);
}

async function createAuthState(shopDomain: string) {
  const creds: any = {};
  const keys: any = {};

  const conn = await prisma.whatsAppConnection.findUnique({ where: { shopDomain } });
  let savedState: any = null;
  if (conn?.qrSessionData) {
    try {
      savedState = JSON.parse(conn.qrSessionData);
    } catch {}
  }

  return {
    state: savedState || { creds, keys },
    saveCreds: async () => {
      try {
        await prisma.whatsAppConnection.updateMany({
          where: { shopDomain },
          data: { qrSessionData: JSON.stringify({ creds, keys }) },
        });
      } catch {}
    },
  };
}

export function isConnected(shopDomain: string): boolean {
  return activeSockets.has(shopDomain);
}
