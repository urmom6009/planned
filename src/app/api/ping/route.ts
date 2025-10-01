// app/api/ping/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const auth = req.headers.get("authorization");

    if (!auth?.startsWith("Bearer ")) {
        return NextResponse.json({ ok: false, error: "Missing or invalid Authorization header" }, { status: 401 });
    }

    const token = auth.slice("Bearer ".length);

    // 🔐 Replace this with however you validate tokens in your app.
    // For now, we'll just check that it's non-empty.
    if (!token) {
        return NextResponse.json({ ok: false, error: "Empty token" }, { status: 401 });
    }

    // If you want, validate against process.env.APP_TOKEN or a DB lookup:
    // if (token !== process.env.EXPECTED_TOKEN) { ... }

    return NextResponse.json({ ok: true, message: "Pong 🏓" }, { status: 200 });
}