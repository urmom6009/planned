import {NextResponse } from "next/server";
const AUTH_COOKIE = "dp_auth";

export async function POST() {
    const res = NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"));
    res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0});
    return res;
}