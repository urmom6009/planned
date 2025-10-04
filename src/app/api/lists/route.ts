// src/app/api/lists/route.ts
// src/app/api/lists/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireBearer } from "@/lib/auth";
// import { prisma } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// shape of each list item
interface List {
    id: string;
    name: string;
}

export async function GET(req: NextRequest): Promise<NextResponse<List[] | { error: string }>> {
    try {
        // validate auth header
        requireBearer(req);

        // placeholder for DB query — replace later with actual prisma call
        // const lists = await prisma.list.findMany({ select: { id: true, name: true } });
        const lists: List[] = [];

        return NextResponse.json(lists, { status: 200 });
    } catch (err: unknown) {
        const error: Error =
            err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err));
        const status: number =
            typeof (err as { status?: number }).status === "number"
                ? (err as { status: number }).status
                : 500;

        return NextResponse.json({ error: error.message }, { status });
    }
}