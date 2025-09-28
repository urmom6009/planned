import { NextRequest, NextResponse } from "next/server";
const AUTH_COOKIE = "dp_auth";

export async function POST(req: NextRequest) {
    const form = await req.formData();
    const user = String(form.get("username") ?? "").trim();
    const pass = String(form.get("password") ?? "").trim();
    const next = String(form.get("next") ?? "/");

    const U = (process.env.BASIC_USER ?? "").trim();
    const P = (process.env.BASIC_PASS ?? "").trim();

    // Helpful dev guard: tell you if envs are missing locally
    if (!U || !P) {
        // Don’t leak values, just tell you they’re missing
        if (process.env.NODE_ENV !== "production") {
            return new NextResponse(
                "Dev hint: BASIC_USER or BASIC_PASS not set. Add them to .env.local and restart.",
                { status: 400 }
            );
        }
    }

    const ok = user === U && pass === P;

    const to = next.startsWith("/") ? next : "/";

    const res = NextResponse.redirect(new URL(ok ? to : `/login?error=1`, req.url));
    res.cookies.set(AUTH_COOKIE, ok ? "1" : "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: ok ? 60 * 60 * 24 * 7 : 0,
    });
    return res;
}