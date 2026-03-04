import crypto from "node:crypto";

export function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function hmacHex(secret: string, data: string): string {
  return crypto.createHmac("sha256", secret).update(data, "utf8").digest("hex");
}

export function hmacBase64(secret: string, data: Buffer): string {
  return crypto.createHmac("sha256", secret).update(data).digest("base64");
}



