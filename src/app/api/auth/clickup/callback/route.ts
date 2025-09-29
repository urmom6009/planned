import { NextRequest, NextResponse } from "next/server";
import { consumeState } from "../start/route";
import { SignJWT } from "jose";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!code || !state || !consumeState(state))
        return NextResponse.json({ error: "invalid state" }, { status: 400 });

    // Exchange code for tokens
    const tokenResp = await fetch("https://api.clickup.com/api/v2/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_id: process.env.CLICKUP_CLIENT_ID,
            client_secret: process.env.CLICKUP_CLIENT_SECRET,
            code,
        }),
    });
    const tokenJson = await tokenResp.json();

    // TODO: store tokenJson securely (DB/KV, encrypted) and fetch default list IDs
    const userId = crypto.randomUUID(); // link to your user model

    // Sign a one-time nonce for the iOS app
    const nonce = crypto.randomUUID();
    const sig = await new SignJWT({ uid: userId, nonce })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("10m")
        .sign(new TextEncoder().encode(process.env.MAGIC_SECRET!));

    // Deep link back to DreamPlanner app
    const deep = `dreamplanner://setup?nonce=${encodeURIComponent(
        nonce
    )}&sig=${encodeURIComponent(sig)}`;

    // Nice HTML page with a button
    return new NextResponse(
        `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;">
       <h1>DreamPlanner Connected</h1>
       <p>Tap below to finish setup in the app:</p>
       <a href="${deep}" style="display:inline-block;
           padding:12px 20px;background:#ec4899;color:white;
           border-radius:8px;text-decoration:none;">
         Open DreamPlanner
       </a>
     </body></html>`,
        { headers: { "Content-Type": "text/html" } }
    );
}