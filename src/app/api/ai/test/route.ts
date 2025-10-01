// src/app/api/ai/test/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";  // or jose if you stuck with it

const SECRET = process.env.MAGIC_SIGNING_SECRET;

export async function GET(req: NextRequest) {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
        return NextResponse.json({ ok: false, error: "Missing token" }, { status: 401 });
    }

    const token = auth.slice(7);
    try {
        const decoded = jwt.verify(token, SECRET!) as { exp?: number, iat?: number };
        const now = Math.floor(Date.now() / 1000);

        const expiresIn = decoded.exp ? decoded.exp - now : null;
        if (expiresIn && expiresIn > 0) {
            return NextResponse.json({ ok: true, expires_in: expiresIn });
        } else {
            return NextResponse.json({ ok: false, error: "Expired" }, { status: 401 });
        }
    } catch (err) {
        return NextResponse.json({ ok: false, error: "Invalid" }, { status: 401 });
    }
}