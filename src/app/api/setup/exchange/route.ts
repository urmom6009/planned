import { NextResponse } from "next/server";
import crypto from "node:crypto";

const SECRET = process.env.MAGIC_SECRET_EXCHANGE; // ✅ matches Vercel

export async function GET(req: Request) {
    if (!SECRET) {
        return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const url = new URL(req.url);
    const nonce = url.searchParams.get("nonce") ?? "";
    const sig = url.searchParams.get("sig") ?? "";
    const expStr = url.searchParams.get("exp") ?? "";
    const exp = Number(expStr);

    if (!nonce || !sig || !exp || Number.isNaN(exp)) {
        return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }
    if (exp < Math.floor(Date.now() / 1000)) {
        return NextResponse.json({ error: "Link expired" }, { status: 400 });
    }

    // recompute signature and timing-safe compare
    const expected = crypto
        .createHmac("sha256", SECRET)
        .update(`${nonce}|${exp}`)
        .digest("base64url");

    const ok =
        expected.length === sig.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));

    if (!ok) {
        return NextResponse.json({ error: "Bad signature" }, { status: 400 });
    }

    // mint an app token (example: random opaque)
    const token = crypto.randomBytes(32).toString("base64url");

    // You can also Set-Cookie here if you prefer a cookie session.
    return NextResponse.json({ token });
}