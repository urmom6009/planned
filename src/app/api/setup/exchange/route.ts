import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";

const ENC = new TextEncoder();

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const nonce = searchParams.get("nonce") || "";
        const sig = searchParams.get("sig") || "";

        const secret = process.env.MAGIC_EXCHANGE_SECRET!;
        if (!secret) return NextResponse.json({ error: "server misconfig" }, { status: 500 });

        // verify HMAC signature: sig = base64url( HMAC_SHA256(secret, nonce) )
        const expected = await hmacB64url(secret, nonce);
        if (sig !== expected) return NextResponse.json({ error: "bad signature" }, { status: 401 });

        const ttlSec = Number(process.env.MAGIC_TOKEN_TTL || "3600");
        const exp = Math.floor(Date.now() / 1000) + ttlSec;

        // Create short-lived JWT the app will send back to us
        const token = await new SignJWT({ typ: "app" })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime(exp)
            .setIssuedAt()
            .sign(ENC.encode(secret));

        return NextResponse.json({ token, exp });
    } catch (e) {
        return NextResponse.json({ error: "exchange failed" }, { status: 400 });
    }
}

async function hmacB64url(secret: string, msg: string) {
    const key = await crypto.subtle.importKey(
        "raw",
        ENC.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, ENC.encode(msg));
    // base64url encode
    const b = Buffer.from(sig);
    return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}