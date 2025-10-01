// src/app/api/ai/test/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Minimal AI health-check.
 * Returns ok: true if:
 *   - client sent a Bearer token (your app token)
 *   - server has OPENAI_API_KEY configured
 * Optionally: you can try a lightweight OpenAI request later.
 */
export async function GET(req: NextRequest) {
    const auth = req.headers.get("authorization") || "";
    const hasBearer = /^Bearer\s+.+/i.test(auth);

    const hasServerKey = !!process.env.OPENAI_API_KEY; // server-side key presence

    // If you have temp-key minting, you could also return an expires_in
    // For now, just mark ok if both sides are wired.
    const ok = hasBearer && hasServerKey;

    return NextResponse.json(
        {
            ok,
            hasAuthorization: hasBearer,
            hasServerKey,
            // expires_in: 3600, // <- uncomment if you want the client to treat as "fresh"
            time: new Date().toISOString(),
        },
        { status: ok ? 200 : 200 } // keep 200 so UI doesn’t break while wiring things
    );
}

/* 
// If you want to actually poke OpenAI later:
try {
  const r = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
  });
  const ok = r.ok;
  ...
} catch (e) { ... }
*/