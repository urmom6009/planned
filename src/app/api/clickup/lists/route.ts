// /src/app/api/clickup/lists/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClickUpList = { id: string; name: string };
type ListsPayload = { lists: ClickUpList[] };

/**
 * Returns lists from env CLICKUP_LIST_IDS as a simple picker source.
 * Format examples:
 *   CLICKUP_LIST_IDS="abc123:Backlog,def456:Sprint,ghi789"
 * (If no name is provided after ":", the id is used as the name.)
 */
export async function GET(_req: NextRequest) {
    const raw = process.env.CLICKUP_LIST_IDS ?? "";
    const lists: ClickUpList[] = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((pair) => {
            const [id, ...nameParts] = pair.split(":");
            const name = nameParts.join(":").trim();
            return { id, name: name || id };
        });

    const payload: ListsPayload = { lists };
    return NextResponse.json(payload);
}