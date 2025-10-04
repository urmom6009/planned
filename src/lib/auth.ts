import type { NextRequest } from "next/server";

/** Returns the Bearer token if provided in Authorization header, else null. */
export function getBearer(req: NextRequest): string | null {
    const h = req.headers.get("authorization");
    if (!h) return null;
    const m = /^Bearer\s+(.+)$/i.exec(h);
    return m ? m[1] : null;
}

/** Throws 401 if the Authorization: Bearer <token> header is missing. */
export function requireBearer(req: NextRequest): string {
    const tok = getBearer(req);
    if (!tok) {
        const err: any = new Error("Unauthorized");
        err.status = 401;
        throw err;
    }
    return tok;
}