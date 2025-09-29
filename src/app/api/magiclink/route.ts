import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
    const { task, mile } = await req.json();

    const secret = process.env.MAGIC_EXCHANGE_SECRET!;
    const base = encodeURIComponent(process.env.BASE_URL ?? "https://your-app.vercel.app");
    const nonce = crypto.randomBytes(24).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(nonce).digest("base64url");

    const link = `dreamplanner://setup?base=${base}&task=${task}&mile=${mile}&nonce=${nonce}&sig=${sig}`;

    return NextResponse.json({ link });
}