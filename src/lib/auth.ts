// src/lib/auth.ts
import type { NextRequest } from "next/server";

export function getBearer(req: NextRequest): string | null {
    const raw = req.headers.get("authorization") ?? "";
    if (raw.toLowerCase().startsWith("bearer ")) return raw.slice(7).trim();
    return null;
}

export function requireBearer(req: NextRequest): string {
    const token = getBearer(req) ?? process.env.CLICKUP_API_TOKEN ?? "";
    if (!token) {
        // Throwing is fine in route handlers; caller returns 401.
        throw new Error("Unauthorized");
    }
    return token;
}