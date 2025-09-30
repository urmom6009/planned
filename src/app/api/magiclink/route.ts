// /src/app/api/magiclink/route.ts
import { NextResponse } from "next/server";
import crypto from "node:crypto";

const SECRET = process.env.MAGIC_SECRET_EXCHANGE; // ✅ matches Vercel
const TOKEN_TTL = Number(process.env.MAGIC_TOKEN_TTL ?? 300); // seconds

export async function GET(req: Request) {
    if (!SECRET) {
        return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const url = new URL(req.url);
    const returnUrl = url.searchParams.get("return") ?? "dreamplanner://setup";

    // nonce = random + expires
    const nonce = crypto.randomBytes(16).toString("hex");
    const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL;

    // signature = HMAC(nonce|exp)
    const sig = crypto
        .createHmac("sha256", SECRET)
        .update(`${nonce}|${exp}`)
        .digest("base64url");

    // redirect deep link: dreamplanner://setup?nonce=...&exp=...&sig=...
    const dest = new URL(returnUrl);
    dest.searchParams.set("nonce", nonce);
    dest.searchParams.set("exp", String(exp));
    dest.searchParams.set("sig", sig);

    return NextResponse.redirect(dest);
}