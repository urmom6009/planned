import { jwtVerify } from "jose";
const ENC = new TextEncoder();
const SECRET = process.env.MAGIC_EXCHANGE_SECRET!;

export async function verifyAppToken(auth?: string | null) {
    if (!auth?.startsWith("Bearer ")) return false;
    try { await jwtVerify(auth.slice(7), ENC.encode(SECRET)); return true; }
    catch { return false; }
}