import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "dp_auth";

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // allow public stuff and auth endpoints
    if (
        pathname.startsWith("/login") ||
        pathname.startsWith("/api/auth/") ||
        pathname.startsWith("/_next/") ||
        pathname.startsWith("/icons") ||
        pathname === "/favicon.ico" ||
        pathname === "/manifest.webmanifest" ||
        pathname.match(/\.(?:js|css|png|jpg|jpeg|gif|svg|ico|webmanifest)$/)
    ) {
        return NextResponse.next();
    }

    const authed = req.cookies.get(AUTH_COOKIE)?.value === "1";
    if (authed) return NextResponse.next();

    // redirect to login with `next` param
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
}

// match everything except Next internals
export const config = {
    matcher: ["/((?!_next/static|_next/image).*)"],
};