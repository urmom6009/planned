import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";

const ENC = new TextEncoder();

async function hmacB64url(secret: string, msg: string) {
    const key = await crypto.subtle.importKey(
        "raw",
        ENC.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, ENC.encode(msg));
    return Buffer.from(sig)
        .toString("base64")
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const nonce = searchParams.get("nonce") || "";
    const sig = searchParams.get("sig") || "";

    const secret = process.env.MAGIC_EXCHANGE_SECRET!;
    if (!secret) {
        return NextResponse.json({ error: "server misconfig" }, { status: 500 });
    }

    // verify sig = HMAC(secret, nonce)
    const expected = await hmacB64url(secret, nonce);
    if (!nonce || !sig || sig !== expected) {
        return NextResponse.json({ error: "bad signature" }, { status: 403 });
    }

    // Issue an app token (JWT) the app can store in keychain as APP_TOKEN
    const appSecret = process.env.MAGIC_LINK_SECRET!;
    if (!appSecret) {
        return NextResponse.json({ error: "server misconfig" }, { status: 500 });
    }

    const token = await new SignJWT({ sub: "dreamplanner", n: nonce })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(ENC.encode(appSecret));

    return NextResponse.json({ token });
}