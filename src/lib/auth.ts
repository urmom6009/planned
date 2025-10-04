// src/lib/auth.ts
export function requireBearer(req: Request) {
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token || token !== process.env.APP_TOKEN_DEV) { // replace with real verify
        return { ok: false as const, status: 401, body: { error: 'Unauthorized' } };
    }
    return { ok: true as const };
}