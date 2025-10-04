import { NextRequest } from "next/server";

export class HttpError extends Error {
    status: number;
    constructor(message: string, status = 400) {
        super(message);
        this.status = status;
    }
}

/** Returns the bearer value, or throws 401. */
export function requireBearer(req: NextRequest): string {
    const h = req.headers.get("authorization") ?? "";
    if (!h.toLowerCase().startsWith("bearer ")) {
        throw new HttpError("Unauthorized", 401);
    }
    const token = h.slice(7).trim();
    if (!token) throw new HttpError("Unauthorized", 401);
    return token;
}