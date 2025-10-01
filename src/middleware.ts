// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const USER = process.env.BASIC_USER;
const PASS = process.env.BASIC_PASS;

// ✅ public endpoints (no Basic auth)
const PUBLIC_PATHS = [
    "/login",
    "/manifest.webmanifest",
    "/api/magiclink",
    "/api/ping",
    "/api/setup/exchange",
    "/api/auth/clickup/start",     // <— add
    "/api/auth/clickup/callback",  // <— add
];

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
        return NextResponse.next();
    }

    if (!USER || !PASS) return NextResponse.next();

    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Basic ")) {
        return new NextResponse("Auth required", {
            status: 401,
            headers: { "WWW-Authenticate": 'Basic realm="DreamPlanner"' },
        });
    }

    const [u, p] = atob(auth.slice(6)).split(":");
    if (u !== USER || p !== PASS) {
        return new NextResponse("Forbidden", { status: 403 });
    }
    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next|icons|.*\\.(?:png|jpg|jpeg|svg|ico|css|js)).*)"],
};