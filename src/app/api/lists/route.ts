import { NextRequest, NextResponse } from "next/server";
import { requireBearer, HttpError } from "@/lib/auth";
import { store, List } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/lists  -> List[] */
export async function GET(req: NextRequest) {
    try {
        requireBearer(req); // we don’t examine the token value here—just require it
        const lists: List[] = store.lists.slice().sort((a, b) => a.name.localeCompare(b.name));
        return NextResponse.json(lists, { status: 200 });
    } catch (err) {
        const e = err as Error;
        const status = e instanceof HttpError ? e.status : 500;
        return NextResponse.json({ error: e.message }, { status });
    }
}