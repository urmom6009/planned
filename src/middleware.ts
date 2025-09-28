import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "dp_auth"; // presence = authenticated

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // public routes that must bypass auth:
    const publicRoutes = [
        "/login",
        "/api/auth/login",
        "/api/auth/logout",
        "/manifest.webmanifest"
    ];
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/icons") ||
        publicRoutes.some((p) => pathname.startsWith(p)) ||
        pathname.match(/\.(?:js|css|png|jpg|jpeg|gif|svg|ico|webmanifest)$/)
    ) {
        return NextResponse.next();
    }

    // check cookie
    const hasAuth = req.cookies.get(AUTH_COOKIE)?.value === "1";
    if (hasAuth) return NextResponse.next();

    // redirect to login
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next|.*\\.(?:js|css|png|jpg|jpeg|gif|svg|ico|webmanifest)$).*)"] };