// app/api/_lib/auth.ts
import { NextRequest, NextResponse } from "next/server";

const ENC = new TextEncoder();

// Opaque HMAC token verify (no deps)
export async function verifyToken(token: string) {
    if (!token) return false;
    const secret = process.env.MAGIC_EXCHANGE_SECRET!;
    try {
        const raw = Buffer.from(token.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
        const [nonce, expStr, sig] = raw.split(".");
        if (!nonce || !expStr || !sig) return false;

        const exp = Number(expStr);
        if (!Number.isFinite(exp) || Math.floor(Date.now() / 1000) > exp) return false;

        const expected = await hmacB64url(secret, `${nonce}.${exp}`);
        return sig === expected;
    } catch { return false; }
}

export async function requireAuth(req: NextRequest) {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const ok = await verifyToken(token);
    if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return null;
}

async function hmacB64url(secret: string, msg: string) {
    const key = await crypto.subtle.importKey("raw", ENC.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, ENC.encode(msg));
    return Buffer.from(sig).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}