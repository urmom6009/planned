// src/app/api/ping/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const auth = req.headers.get("authorization") || "";
    const hasBearer = /^Bearer\s+/i.test(auth);

    return NextResponse.json(
        {
            ok: true,
            env: process.env.VERCEL_ENV ?? "local",
            hasAuthorization: hasBearer,
            time: new Date().toISOString(),
        },
        { status: 200 }
    );
}