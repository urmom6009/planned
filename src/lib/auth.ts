// src/lib/auth.ts
export function getBearer(req: Request): string | null {
    const h = req.headers.get("authorization") || "";
    if (!h.startsWith("Bearer ")) return null;
    const tok = h.slice(7).trim();
    return tok.length ? tok : null;
}