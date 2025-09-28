import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "dp_auth";

export async function POST(req: NextRequest) {
    const body = await req.formData();
    const user = String(body.get("username") ?? "");
    const pass = String(body.get("password") ?? "");
    const next = String(body.get("next") ?? "/");

    const U = process.env.BASIC_USER ?? "";
    const P = process.env.BASIC_PASS ?? "";

    const ok = user === U && pass === P;

    const res = NextResponse.redirect(new URL(ok ? next || "/" : '/login?error=1', req.url));

    // set or clear auth cookie
    res.cookies.set(AUTH_COOKIE, ok ? "1" : "", {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: ok ? 60 * 60 * 24 * 7 : 0, // 7 days on success; clear on failure
    });

    return res;
}